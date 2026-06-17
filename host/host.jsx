/* global app, $ */

(function () {
    function escapeJson(value) {
        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, "\\\"")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t");
    }

    function jsonPair(key, value) {
        return "\"" + key + "\":\"" + escapeJson(value) + "\"";
    }

    $.global.ThomadosFunBox = {
        ping: function () {
            var projectName = "";

            try {
                projectName = app.project ? app.project.name : "";
            } catch (error) {
                projectName = "";
            }

            return "{"
                + "\"ok\":true,"
                + jsonPair("message", "Ponte JSX ativa no Premiere Pro") + ","
                + jsonPair("appName", app.name || "Premiere Pro") + ","
                + jsonPair("appVersion", app.version || "") + ","
                + jsonPair("projectName", projectName)
                + "}";
        }
    };

    $.global.thomadosFunBox_ping = function () {
        return $.global.ThomadosFunBox.ping();
    };
}());
