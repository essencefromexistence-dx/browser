/*
 * Copyright (c) 2026, Dx contributors
 * SPDX-License-Identifier: BSD-2-Clause
 */

#pragma once

#include <functional>

#include <QJsonArray>
#include <QJsonObject>
#include <QJsonValue>
#include <QString>
#include <QVector>

namespace Dx {

// A trusted callable exposed to the UI page through the shell API. Phase 1 of the native
// bindings plan: the call is brokered in the browser process, so it costs one message hop
// and never runs inside the sandboxed renderer.
class NativeRegistry {
public:
    // The handler returns its result and sets `error` on failure. Exceptions are disabled in
    // this build, so errors travel through the out-parameter.
    using Handler = std::function<QJsonValue(QJsonArray const& arguments, QString& error)>;

    NativeRegistry();

    void register_function(QString name, Handler handler);
    bool has_function(QString const& name) const;

    // Returns { "ok": true, "result": ... } or { "ok": false, "error": { ... } }.
    QJsonObject call(QString const& name, QJsonArray const& arguments);

    QJsonArray function_names() const;

private:
    struct Entry {
        QString name;
        Handler handler;
    };
    QVector<Entry> m_entries;
};

}
