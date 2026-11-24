/*
 * Copyright (c) 2026, Dx contributors
 * SPDX-License-Identifier: BSD-2-Clause
 */

#include <UI/Qt/NativeRegistry.h>

#include <QDateTime>
#include <QFile>
#include <QFileInfo>
#include <QSysInfo>

namespace Dx {

NativeRegistry::NativeRegistry()
{
    // Built-in functions. These are deliberately tiny; a module that needs real work should
    // register one handler and do the work on its own thread.
    register_function("app.version", [](QJsonArray const&, QString&) -> QJsonValue {
        return QJsonValue(QStringLiteral("0.1.0"));
    });

    register_function("app.platform", [](QJsonArray const&, QString&) -> QJsonValue {
        QJsonObject result;
        result.insert(QStringLiteral("os"), QSysInfo::productType());
        result.insert(QStringLiteral("kernel"), QSysInfo::kernelType());
        result.insert(QStringLiteral("arch"), QSysInfo::currentCpuArchitecture());
        return result;
    });

    register_function("time.nowMs", [](QJsonArray const&, QString&) -> QJsonValue {
        return QJsonValue(static_cast<double>(QDateTime::currentMSecsSinceEpoch()));
    });

    register_function("fs.readText", [](QJsonArray const& arguments, QString& error) -> QJsonValue {
        if (arguments.size() != 1 || !arguments.at(0).isString()) {
            error = QStringLiteral("fs.readText expects one path argument");
            return {};
        }

        QFile file(arguments.at(0).toString());
        if (!file.open(QIODevice::ReadOnly)) {
            error = QStringLiteral("cannot open file");
            return {};
        }
        return QJsonValue(QString::fromUtf8(file.readAll()));
    });

    register_function("fs.writeText", [](QJsonArray const& arguments, QString& error) -> QJsonValue {
        if (arguments.size() != 2 || !arguments.at(0).isString() || !arguments.at(1).isString()) {
            error = QStringLiteral("fs.writeText expects (path, text)");
            return {};
        }

        QFile file(arguments.at(0).toString());
        if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
            error = QStringLiteral("cannot open file for writing");
            return {};
        }
        file.write(arguments.at(1).toString().toUtf8());
        return QJsonValue(true);
    });

    register_function("fs.exists", [](QJsonArray const& arguments, QString& error) -> QJsonValue {
        if (arguments.size() != 1 || !arguments.at(0).isString()) {
            error = QStringLiteral("fs.exists expects one path argument");
            return {};
        }
        return QJsonValue(QFileInfo::exists(arguments.at(0).toString()));
    });
}

void NativeRegistry::register_function(QString name, Handler handler)
{
    for (auto& entry : m_entries) {
        if (entry.name == name) {
            entry.handler = std::move(handler);
            return;
        }
    }
    m_entries.append({ std::move(name), std::move(handler) });
}

bool NativeRegistry::has_function(QString const& name) const
{
    for (auto const& entry : m_entries) {
        if (entry.name == name)
            return true;
    }
    return false;
}

QJsonObject NativeRegistry::call(QString const& name, QJsonArray const& arguments)
{
    for (auto const& entry : m_entries) {
        if (entry.name != name)
            continue;

        QString error;
        auto value = entry.handler(arguments, error);

        QJsonObject response;
        if (error.isEmpty()) {
            response.insert(QStringLiteral("ok"), true);
            response.insert(QStringLiteral("result"), value);
        } else {
            QJsonObject detail;
            detail.insert(QStringLiteral("code"), QStringLiteral("native_error"));
            detail.insert(QStringLiteral("message"), error);
            response.insert(QStringLiteral("ok"), false);
            response.insert(QStringLiteral("error"), detail);
        }
        return response;
    }

    QJsonObject detail;
    detail.insert(QStringLiteral("code"), QStringLiteral("unknown_function"));
    detail.insert(QStringLiteral("message"), QStringLiteral("no native function named ") + name);

    QJsonObject response;
    response.insert(QStringLiteral("ok"), false);
    response.insert(QStringLiteral("error"), detail);
    return response;
}

QJsonArray NativeRegistry::function_names() const
{
    QJsonArray names;
    for (auto const& entry : m_entries)
        names.append(entry.name);
    return names;
}

}
