/*
 * Copyright (c) 2026, Dx contributors
 * SPDX-License-Identifier: BSD-2-Clause
 */

#pragma once

#include <QJsonArray>
#include <QJsonValue>
#include <QString>
#include <QStringList>
#include <QVector>

namespace Dx {

// Loads a native module (DLL/SO/dylib) that implements the dx_native_v1 C ABI. Modules are
// only reachable from trusted UI origins; a site never gets here. This class is platform
// neutral and is intended to be hosted by WebContent, next to the JS binding (see PLAN.md M6).
class NativeModuleHost {
public:
    explicit NativeModuleHost(QStringList allowed_origins = {});
    ~NativeModuleHost();

    void set_module_directory(QString const& directory);

    // Loads `<directory>/<name>` with the platform suffix, if it is not already loaded.
    bool load(QString const& name, QString* error = nullptr);

    bool has_function(QString const& name) const;
    QStringList function_names() const;
    QStringList loaded_modules() const { return m_loaded_modules; }

    bool is_origin_allowed(QString const& origin) const;

    // Throws QString on marshalling or module error, matching NativeRegistry's convention.
    // Sets `error` on a marshalling or module failure, matching NativeRegistry's convention.
    QJsonValue call(QString const& function_name, QJsonArray const& arguments, QString& error);

private:
    struct Module {
        QString name;
        void* handle { nullptr };
        void* exports { nullptr };
    };

    QStringList m_allowed_origins;
    QString m_module_directory;
    QVector<Module> m_modules;
    QStringList m_loaded_modules;
};

}
