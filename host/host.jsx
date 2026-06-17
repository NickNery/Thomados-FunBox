/* global app, $ */

(function () {
    var KF_INTERP_MODE_BEZIER = 5;

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

    function stringifyJson(value) {
        var index;
        var items;
        var key;

        if (value === null || value === undefined) {
            return "null";
        }

        if (typeof value === "number") {
            return isFinite(value) ? String(value) : "0";
        }

        if (typeof value === "boolean") {
            return value ? "true" : "false";
        }

        if (typeof value === "string") {
            return "\"" + escapeJson(value) + "\"";
        }

        if (value instanceof Array) {
            items = [];

            for (index = 0; index < value.length; index += 1) {
                items.push(stringifyJson(value[index]));
            }

            return "[" + items.join(",") + "]";
        }

        items = [];

        for (key in value) {
            if (value.hasOwnProperty(key)) {
                items.push("\"" + escapeJson(key) + "\":" + stringifyJson(value[key]));
            }
        }

        return "{" + items.join(",") + "}";
    }

    function jsonPair(key, value) {
        return "\"" + key + "\":\"" + escapeJson(value) + "\"";
    }

    function numberValue(value, fallback) {
        var parsed = Number(value);
        return isFinite(parsed) ? parsed : fallback;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function getCollectionLength(collection) {
        if (!collection || collection === 0) {
            return 0;
        }

        if (typeof collection.length === "number") {
            return collection.length;
        }

        if (typeof collection.numItems === "number") {
            return collection.numItems;
        }

        return 0;
    }

    function getCollectionItem(collection, index) {
        if (!collection || collection === 0) {
            return null;
        }

        if (collection[index]) {
            return collection[index];
        }

        if (typeof collection.getItemAt === "function") {
            return collection.getItemAt(index);
        }

        return null;
    }

    function collectionToArray(collection) {
        var items = [];
        var length = getCollectionLength(collection);
        var index;
        var item;

        for (index = 0; index < length; index += 1) {
            item = getCollectionItem(collection, index);

            if (item) {
                items.push(item);
            }
        }

        return items;
    }

    function normalizeEase(ease) {
        ease = ease || {};

        return {
            incoming: {
                speed: clamp(numberValue(ease.incoming && ease.incoming.speed, 0), 0, 10000),
                influence: clamp(numberValue(ease.incoming && ease.incoming.influence, 33), 0.1, 100)
            },
            outgoing: {
                speed: clamp(numberValue(ease.outgoing && ease.outgoing.speed, 0), 0, 10000),
                influence: clamp(numberValue(ease.outgoing && ease.outgoing.influence, 33), 0.1, 100)
            }
        };
    }

    function getPropertyName(property, fallback) {
        try {
            return property.displayName || property.name || fallback;
        } catch (error) {
            return fallback;
        }
    }

    function getTargetKeys(property) {
        var keys = 0;
        var source = "all";

        try {
            if (typeof property.getSelectedKeys === "function") {
                keys = property.getSelectedKeys();
                source = "selected";
            } else if (typeof property.getSelectedKeyframes === "function") {
                keys = property.getSelectedKeyframes();
                source = "selected";
            }
        } catch (error) {
            keys = 0;
        }

        if (!keys || getCollectionLength(keys) === 0) {
            try {
                keys = typeof property.getKeys === "function" ? property.getKeys() : 0;
                source = "all";
            } catch (fallbackError) {
                keys = 0;
            }
        }

        return {
            keys: collectionToArray(keys),
            source: source
        };
    }

    function createTemporalEase(speed, influence) {
        return {
            speed: speed,
            influence: influence
        };
    }

    function callTemporalEase(property, keyTime, ease) {
        var incoming = createTemporalEase(ease.incoming.speed, ease.incoming.influence);
        var outgoing = createTemporalEase(ease.outgoing.speed, ease.outgoing.influence);

        if (typeof property.setTemporalEaseAtKey !== "function") {
            return false;
        }

        try {
            property.setTemporalEaseAtKey(keyTime, incoming, outgoing, 1);
            return true;
        } catch (firstError) {
            try {
                property.setTemporalEaseAtKey(keyTime, [incoming], [outgoing], 1);
                return true;
            } catch (secondError) {
                try {
                    property.setTemporalEaseAtKey(
                        keyTime,
                        incoming.speed,
                        incoming.influence,
                        outgoing.speed,
                        outgoing.influence,
                        1
                    );
                    return true;
                } catch (thirdError) {
                    return false;
                }
            }
        }
    }

    function applyEaseToKey(property, keyTime, ease) {
        var temporalApplied = callTemporalEase(property, keyTime, ease);

        if (typeof property.setInterpolationTypeAtKey === "function") {
            try {
                property.setInterpolationTypeAtKey(keyTime, KF_INTERP_MODE_BEZIER, 1);
            } catch (error) {
                if (!temporalApplied) {
                    throw error;
                }
            }
        }

        return temporalApplied;
    }

    function applyTemporalEase(payload) {
        var result = {
            ok: false,
            message: "",
            applied: 0,
            clips: 0,
            components: 0,
            properties: 0,
            keys: 0,
            fallbacks: 0,
            warnings: []
        };
        var ease = normalizeEase(payload && payload.ease);
        var sequence;
        var selectedClips;
        var clipIndex;
        var componentIndex;
        var propertyIndex;
        var keyIndex;
        var clip;
        var components;
        var component;
        var properties;
        var property;
        var targetKeys;
        var keyTime;
        var usedTemporalEase;

        try {
            sequence = app.project && app.project.activeSequence;
        } catch (error) {
            sequence = null;
        }

        if (!sequence) {
            result.message = "Nenhuma sequencia ativa encontrada.";
            return result;
        }

        try {
            selectedClips = sequence.getSelection();
        } catch (selectionError) {
            selectedClips = [];
        }

        selectedClips = collectionToArray(selectedClips);

        if (selectedClips.length === 0) {
            result.message = "Nenhum clip selecionado na timeline.";
            return result;
        }

        result.clips = selectedClips.length;

        for (clipIndex = 0; clipIndex < selectedClips.length; clipIndex += 1) {
            clip = selectedClips[clipIndex];
            components = collectionToArray(clip.components);

            for (componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
                component = components[componentIndex];
                properties = collectionToArray(component.properties);
                result.components += 1;

                for (propertyIndex = 0; propertyIndex < properties.length; propertyIndex += 1) {
                    property = properties[propertyIndex];

                    try {
                        if (typeof property.isTimeVarying === "function" && property.isTimeVarying() !== true) {
                            continue;
                        }

                        targetKeys = getTargetKeys(property);

                        if (targetKeys.keys.length === 0) {
                            continue;
                        }

                        if (targetKeys.source === "all") {
                            result.warnings.push(
                                "Selecao de keyframes indisponivel para "
                                + getPropertyName(property, "propriedade")
                                + "; aplicando em todos os keyframes do parametro."
                            );
                        }

                        result.properties += 1;

                        for (keyIndex = 0; keyIndex < targetKeys.keys.length; keyIndex += 1) {
                            keyTime = targetKeys.keys[keyIndex];
                            usedTemporalEase = applyEaseToKey(property, keyTime, ease);
                            result.keys += 1;
                            result.applied += 1;

                            if (!usedTemporalEase) {
                                result.fallbacks += 1;
                            }
                        }
                    } catch (propertyError) {
                        result.warnings.push(
                            "Falha em "
                            + getPropertyName(property, "propriedade")
                            + ": "
                            + propertyError
                        );
                    }
                }
            }
        }

        result.ok = result.applied > 0;
        result.message = result.ok
            ? "Ease temporal aplicado aos keyframes encontrados."
            : "Nenhum parametro keyframado foi encontrado nos clips selecionados.";

        if (result.fallbacks > 0) {
            result.warnings.push(
                "setTemporalEaseAtKey nao esta disponivel para todos os parametros; fallback Bezier foi usado."
            );
        }

        return result;
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
        },

        applyTemporalEase: function (payload) {
            return stringifyJson(applyTemporalEase(payload));
        }
    };

    $.global.thomadosFunBox_ping = function () {
        return $.global.ThomadosFunBox.ping();
    };

    $.global.thomadosFunBox_applyTemporalEase = function (payload) {
        return $.global.ThomadosFunBox.applyTemporalEase(payload);
    };
}());
