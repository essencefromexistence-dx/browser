/*
 * Copyright (c) 2026, Dx contributors
 * SPDX-License-Identifier: BSD-2-Clause
 */

#include <UI/Qt/NativeModuleHost.h>
#include <UI/Qt/native/dx_native_v1.h>

#include <QByteArray>
#include <QDir>
#include <QLibrary>
#include <QJsonArray>

namespace Dx {

static constexpr int maximum_arguments = 16;

NativeModuleHost::NativeModuleHost(QStringList allowed_origins)
    : m_allowed_origins(std::move(allowed_origins))
{
}

NativeModuleHost::~NativeModuleHost()
{
    for (auto& module : m_modules) {
        if (auto* library = static_cast<QLibrary*>(module.handle))
            library->unload();
        delete static_cast<QLibrary*>(module.handle);
    }
}

void NativeModuleHost::set_module_directory(QString const& directory)
{
    m_module_directory = directory;
}

bool NativeModuleHost::is_origin_allowed(QString const& origin) const
{
    for (auto const& allowed : m_allowed_origins) {
        if (origin.startsWith(allowed, Qt::CaseInsensitive))
            return true;
    }
    return false;
}

bool NativeModuleHost::load(QString const& name, QString* error)
{
    for (auto const& module : m_modules) {
        if (module.name == name)
            return true;
    }

    if (m_module_directory.isEmpty()) {
        if (error)
            *error = QStringLiteral("no module directory configured");
        return false;
    }

    auto path = QDir(m_module_directory).filePath(name);
    auto* library = new QLibrary(path);
    library->setLoadHints(QLibrary::ResolveAllSymbolsHint);

    if (!library->load()) {
        if (error)
            *error = library->errorString();
        delete library;
        return false;
    }

    using ModuleEntry = DxNativeModule const* (*)();
    auto entry = reinterpret_cast<ModuleEntry>(library->resolve("dx_native_module"));
    if (!entry) {
        if (error)
            *error = QStringLiteral("module does not export dx_native_module");
        library->unload();
        delete library;
        return false;
    }

    auto const* module = entry();
    if (!module || module->abi_version != DX_NATIVE_ABI_VERSION) {
        if (error)
            *error = QStringLiteral("module ABI version mismatch");
        library->unload();
        delete library;
        return false;
    }

    m_modules.append({ name, library, const_cast<DxNativeModule*>(module) });
    m_loaded_modules.append(name);
    return true;
}

bool NativeModuleHost::has_function(QString const& name) const
{
    for (auto const& module : m_modules) {
        auto const* native_module = static_cast<DxNativeModule const*>(module.exports);
        size_t count = 0;
        auto const* exports = native_module->exports(&count);
        for (size_t i = 0; i < count; ++i) {
            if (name == QString::fromUtf8(exports[i].name))
                return true;
        }
    }
    return false;
}

QStringList NativeModuleHost::function_names() const
{
    QStringList names;
    for (auto const& module : m_modules) {
        auto const* native_module = static_cast<DxNativeModule const*>(module.exports);
        size_t count = 0;
        auto const* exports = native_module->exports(&count);
        for (size_t i = 0; i < count; ++i)
            names.append(QString::fromUtf8(exports[i].name));
    }
    return names;
}

static DxNativeValue value_from_json(QJsonValue const& value, QByteArray& string_storage)
{
    DxNativeValue native {};
    native.type = DX_NATIVE_NULL;

    if (value.isBool()) {
        native.type = DX_NATIVE_BOOL;
        native.value.bool_value = value.toBool() ? 1 : 0;
    } else if (value.isDouble()) {
        auto number = value.toDouble();
        if (number == static_cast<double>(static_cast<int64_t>(number))) {
            native.type = DX_NATIVE_INT;
            native.value.int_value = static_cast<int64_t>(number);
        } else {
            native.type = DX_NATIVE_FLOAT;
            native.value.float_value = number;
        }
    } else if (value.isString()) {
        string_storage = value.toString().toUtf8();
        native.type = DX_NATIVE_STRING;
        native.value.string_value.data = string_storage.constData();
        native.value.string_value.size = static_cast<size_t>(string_storage.size());
    }

    return native;
}

static QJsonValue json_from_value(DxNativeValue const& value)
{
    switch (value.type) {
    case DX_NATIVE_BOOL:
        return QJsonValue(value.value.bool_value != 0);
    case DX_NATIVE_INT:
        return QJsonValue(static_cast<double>(value.value.int_value));
    case DX_NATIVE_FLOAT:
        return QJsonValue(value.value.float_value);
    case DX_NATIVE_STRING:
        return QJsonValue(QString::fromUtf8(value.value.string_value.data, static_cast<int>(value.value.string_value.size)));
    case DX_NATIVE_BYTES:
        return QJsonValue(QString::fromLatin1(QByteArray(static_cast<char const*>(value.value.bytes_value.data), static_cast<int>(value.value.bytes_value.size)).toBase64()));
    case DX_NATIVE_NULL:
    default:
        return QJsonValue();
    }
}

QJsonValue NativeModuleHost::call(QString const& function_name, QJsonArray const& arguments, QString& error)
{
    if (arguments.size() > maximum_arguments) {
        error = QStringLiteral("too many native arguments");
        return {};
    }

    QVector<QByteArray> string_storage;
    string_storage.reserve(arguments.size());

    QVector<DxNativeValue> native_arguments;
    native_arguments.reserve(arguments.size());

    for (auto const& argument : arguments) {
        string_storage.append(QByteArray {});
        native_arguments.append(value_from_json(argument, string_storage.last()));
    }

    for (auto const& module : m_modules) {
        auto const* native_module = static_cast<DxNativeModule const*>(module.exports);
        size_t count = 0;
        auto const* exports = native_module->exports(&count);
        for (size_t i = 0; i < count; ++i) {
            if (function_name != QString::fromUtf8(exports[i].name))
                continue;
            auto result = exports[i].function(static_cast<int>(native_arguments.size()), native_arguments.constData(), exports[i].user_data);
            return json_from_value(result);
        }
    }

    error = QStringLiteral("no native export named ") + function_name;
    return {};
}

}
