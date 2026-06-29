/* global app, $, File, Time */

(function () {
    var KF_INTERP_MODE_LINEAR = 0;
    var KF_INTERP_MODE_BEZIER = 5;
    var TICKS_PER_SECOND = 254016000000;
    var EXPECTED_PREMIERE_VERSION = "26.2.2";

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

    function normalizeIdentifier(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[\u00c0-\u00c5\u00e0-\u00e5]/g, "a")
            .replace(/[\u00c8-\u00cb\u00e8-\u00eb]/g, "e")
            .replace(/[\u00cc-\u00cf\u00ec-\u00ef]/g, "i")
            .replace(/[\u00d2-\u00d6\u00f2-\u00f6]/g, "o")
            .replace(/[\u00d9-\u00dc\u00f9-\u00fc]/g, "u")
            .replace(/[\u00c7\u00e7]/g, "c")
            .replace(/[\u00d1\u00f1]/g, "n")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/^\s+|\s+$/g, "");
    }

    function isExpectedPremiereVersion() {
        try {
            return String(app.version || "").indexOf(EXPECTED_PREMIERE_VERSION) === 0;
        } catch (error) {
            return false;
        }
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

        if (typeof collection.numTracks === "number") {
            return collection.numTracks;
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

    function normalizeCurve(curve) {
        var outgoing;
        var incoming;

        curve = curve || {};
        outgoing = curve.outgoing || {};
        incoming = curve.incoming || {};

        outgoing = {
            x: clamp(numberValue(outgoing.x, 0.33), 0.02, 0.96),
            y: clamp(numberValue(outgoing.y, 0.1), 0, 1)
        };

        incoming = {
            x: clamp(numberValue(incoming.x, 0.67), outgoing.x + 0.02, 0.98),
            y: clamp(numberValue(incoming.y, 0.9), 0, 1)
        };

        return {
            outgoing: outgoing,
            incoming: incoming
        };
    }

    function normalizeBakeOptions(bake) {
        bake = bake || {};

        return {
            samples: Math.round(clamp(numberValue(bake.samples, 8), 1, 32)),
            replaceInteriorKeys: bake.replaceInteriorKeys !== false
        };
    }

    function normalizeTextAnimationPayload(payload) {
        var supportedTypes = {
            "pop-in": true,
            "slide-up": true,
            "fade-scale": true,
            "typewriter": true,
            "custom": true
        };

        payload = payload || {};

        if (!supportedTypes[payload.type]) {
            payload.type = "pop-in";
        }

        return {
            type: payload.type,
            duration: clamp(numberValue(payload.duration, 1.5), 0.25, 8),
            target: "selection",
            presetName: payload.presetName ? String(payload.presetName) : String(payload.type),
            recipe: normalizeTextAnimationRecipe(payload.recipe, payload.type)
        };
    }

    function defaultTextAnimationRecipe(type) {
        if (type === "pop-in") {
            return {
                scaleStart: 0,
                scaleOvershoot: 110,
                opacityStart: 0
            };
        }

        if (type === "slide-up") {
            return {
                positionYOffset: 120,
                opacityStart: 0
            };
        }

        if (type === "fade-scale") {
            return {
                scaleStart: 92,
                opacityStart: 0
            };
        }

        if (type === "typewriter") {
            return {
                opacityStart: 0,
                reveal: true
            };
        }

        return {
            scaleStart: 92,
            opacityStart: 0
        };
    }

    function optionalRecipeNumber(recipe, key, min, max) {
        if (!recipe || recipe[key] === undefined || recipe[key] === null || recipe[key] === "") {
            return null;
        }

        return clamp(numberValue(recipe[key], 0), min, max);
    }

    function normalizeTextAnimationRecipe(recipe, type) {
        var source = recipe || defaultTextAnimationRecipe(type);
        var normalized = {
            scaleStart: optionalRecipeNumber(source, "scaleStart", 0, 300),
            scaleOvershoot: optionalRecipeNumber(source, "scaleOvershoot", 0, 300),
            positionYOffset: optionalRecipeNumber(source, "positionYOffset", -500, 500),
            opacityStart: optionalRecipeNumber(source, "opacityStart", 0, 100),
            reveal: source && source.reveal === true
        };

        if (normalized.scaleStart !== null && normalized.scaleOvershoot === null) {
            normalized.scaleOvershoot = 100;
        }

        return normalized;
    }

    function cubicValue(start, controlA, controlB, end, progress) {
        var inverse = 1 - progress;

        return inverse * inverse * inverse * start
            + 3 * inverse * inverse * progress * controlA
            + 3 * inverse * progress * progress * controlB
            + progress * progress * progress * end;
    }

    function curveYAtX(x, curve) {
        var low = 0;
        var high = 1;
        var index;
        var mid;
        var bezierX;

        x = clamp(x, 0, 1);

        for (index = 0; index < 24; index += 1) {
            mid = (low + high) / 2;
            bezierX = cubicValue(0, curve.outgoing.x, curve.incoming.x, 1, mid);

            if (bezierX < x) {
                low = mid;
            } else {
                high = mid;
            }
        }

        return clamp(cubicValue(0, curve.outgoing.y, curve.incoming.y, 1, (low + high) / 2), 0, 1);
    }

    function timeToSeconds(time) {
        var ticks;
        var parsed;

        if (time && typeof time.seconds === "number" && isFinite(time.seconds)) {
            return time.seconds;
        }

        if (time && time.ticks !== undefined) {
            ticks = Number(time.ticks);

            if (isFinite(ticks)) {
                return ticks / TICKS_PER_SECOND;
            }
        }

        parsed = Number(time);
        return isFinite(parsed) ? parsed : NaN;
    }

    function createTimeFromSeconds(seconds) {
        var time = new Time();
        var denominator = 1000000;

        try {
            time.seconds = seconds;
            return time;
        } catch (secondsError) {
            // Fall back to the documented fraction setter below.
        }

        if (typeof time.setSecondsAsFraction === "function") {
            time.setSecondsAsFraction(Math.round(seconds * denominator), denominator);
        } else {
            time.seconds = seconds;
        }

        return time;
    }

    function timeOffset(baseTime, secondsOffset) {
        return createTimeFromSeconds(timeToSeconds(baseTime) + secondsOffset);
    }

    function sortKeysByTime(keys) {
        keys = keys.slice(0);
        keys.sort(function (left, right) {
            return timeToSeconds(left) - timeToSeconds(right);
        });
        return keys;
    }

    function interpolateValue(startValue, endValue, progress) {
        var values = [];
        var index;
        var item;

        if (typeof startValue === "number" && typeof endValue === "number") {
            return startValue + (endValue - startValue) * progress;
        }

        if (startValue instanceof Array && endValue instanceof Array && startValue.length === endValue.length) {
            for (index = 0; index < startValue.length; index += 1) {
                item = interpolateValue(startValue[index], endValue[index], progress);

                if (item === null) {
                    return null;
                }

                values.push(item);
            }

            return values;
        }

        return null;
    }

    function setInterpolationMode(property, keyTime, mode) {
        if (typeof property.setInterpolationTypeAtKey !== "function") {
            return false;
        }

        try {
            property.setInterpolationTypeAtKey(keyTime, mode, 1);
            return true;
        } catch (error) {
            return false;
        }
    }

    function setBakedValueAtKey(property, keyTime, value) {
        if (typeof property.addKey === "function") {
            try {
                property.addKey(keyTime);
            } catch (addError) {
                // Some Premiere parameters can still accept setValueAtKey after addKey fails.
            }
        }

        if (typeof property.setValueAtKey !== "function") {
            throw new Error("Parametro sem setValueAtKey.");
        }

        property.setValueAtKey(keyTime, value, 1);
    }

    function getValueAtKeyTime(property, keyTime) {
        if (typeof property.getValueAtKey === "function") {
            try {
                return property.getValueAtKey(keyTime);
            } catch (keyError) {
                // Fall back to sampling the stream at the same time.
            }
        }

        if (typeof property.getValueAtTime === "function") {
            return property.getValueAtTime(keyTime);
        }

        throw new Error("Parametro sem getValueAtKey/getValueAtTime.");
    }

    function getPropertyName(property, fallback) {
        try {
            return property.displayName || property.name || fallback;
        } catch (error) {
            return fallback;
        }
    }

    function getNormalizedPropertyName(property) {
        return normalizeIdentifier(getPropertyName(property, ""));
    }

    function nameMatchesAliases(name, aliases) {
        var index;

        for (index = 0; index < aliases.length; index += 1) {
            if (name.indexOf(aliases[index]) !== -1) {
                return true;
            }
        }

        return false;
    }

    function componentMatches(component, componentMatchNames) {
        var matchName;
        var displayName;

        if (!componentMatchNames || componentMatchNames.length === 0) {
            return true;
        }

        try {
            matchName = normalizeIdentifier(component.matchName);
            displayName = normalizeIdentifier(component.displayName);
        } catch (error) {
            return false;
        }

        return nameMatchesAliases(matchName, componentMatchNames)
            || nameMatchesAliases(displayName, componentMatchNames);
    }

    function findParamInComponents(components, aliases, componentMatchNames) {
        var componentIndex;
        var propertyIndex;
        var properties;
        var property;
        var name;

        for (componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
            if (!componentMatches(components[componentIndex], componentMatchNames)) {
                continue;
            }

            properties = collectionToArray(components[componentIndex].properties);

            for (propertyIndex = 0; propertyIndex < properties.length; propertyIndex += 1) {
                property = properties[propertyIndex];
                name = getNormalizedPropertyName(property);

                if (nameMatchesAliases(name, aliases)) {
                    return property;
                }
            }
        }

        return null;
    }

    function findComponentParam(trackItem, aliases, componentMatchNames) {
        var components = collectionToArray(trackItem.components);
        var property = findParamInComponents(components, aliases, componentMatchNames);

        if (!property && componentMatchNames && componentMatchNames.length > 0) {
            property = findParamInComponents(components, aliases, null);
        }

        return property;
    }

    function findMgtParam(trackItem, aliases) {
        var component;
        var properties;
        var index;
        var property;

        component = null;

        try {
            if (typeof trackItem.getMGTComponent === "function") {
                component = trackItem.getMGTComponent();
            }
        } catch (error) {
            component = null;
        }

        if (component) {
            properties = collectionToArray(component.properties);

            for (index = 0; index < properties.length; index += 1) {
                property = properties[index];

                if (nameMatchesAliases(getNormalizedPropertyName(property), aliases)) {
                    return property;
                }
            }
        }

        return findComponentParam(trackItem, aliases, ["capsule", "graphic parameters", "mgt"]);
    }

    function enableKeyframes(property) {
        if (!property) {
            return false;
        }

        if (typeof property.areKeyframesSupported === "function") {
            try {
                if (property.areKeyframesSupported() !== true) {
                    return false;
                }
            } catch (supportError) {
                // Continue; some parameters throw but still accept keyframes.
            }
        }

        if (typeof property.setTimeVarying === "function") {
            try {
                property.setTimeVarying(true);
            } catch (varyingError) {
                // Continue; addKey/setValueAtKey may still work.
            }
        }

        return typeof property.setValueAtKey === "function";
    }

    function setAnimationKey(property, keyTime, value) {
        if (!enableKeyframes(property)) {
            return false;
        }

        if (typeof property.addKey === "function") {
            try {
                property.addKey(keyTime);
            } catch (addError) {
                // setValueAtKey can succeed even if addKey reports an unknown error.
            }
        }

        property.setValueAtKey(keyTime, value, 1);
        setInterpolationMode(property, keyTime, KF_INTERP_MODE_BEZIER);
        return true;
    }

    function currentParamValue(property, fallback) {
        if (!property) {
            return fallback;
        }

        if (typeof property.getValue === "function") {
            try {
                return property.getValue();
            } catch (error) {
                return fallback;
            }
        }

        return fallback;
    }

    function getSequenceFrameHeight(sequence) {
        var settings;
        var height;

        try {
            settings = sequence && typeof sequence.getSettings === "function" ? sequence.getSettings() : null;
            height = settings ? Number(settings.videoFrameHeight) : NaN;
        } catch (error) {
            height = NaN;
        }

        return isFinite(height) && height > 0 ? height : 1080;
    }

    function addPositionOffset(value, xOffset, yOffset, sequence) {
        var next;
        var scalarOffset;
        var frameHeight = getSequenceFrameHeight(sequence);

        if (value instanceof Array && value.length >= 2) {
            next = value.slice(0);
            scalarOffset = Math.abs(Number(next[1])) > 2 ? yOffset : yOffset / frameHeight;
            next[0] = Number(next[0]) + (Math.abs(Number(next[0])) > 2 ? xOffset : xOffset / frameHeight);
            next[1] = Number(next[1]) + scalarOffset;
            return next;
        }

        return value;
    }

    function pushUnique(items, item) {
        if (items.join("|").indexOf(item) === -1) {
            items.push(item);
        }
    }

    function getTargetKeys(property) {
        var keys = 0;
        var source = "all";
        var hasSelectedKeyApi = false;

        try {
            if (typeof property.getSelectedKeys === "function") {
                hasSelectedKeyApi = true;
                keys = property.getSelectedKeys();
                source = "selected";
            } else if (typeof property.getSelectedKeyframes === "function") {
                hasSelectedKeyApi = true;
                keys = property.getSelectedKeyframes();
                source = "selected";
            }
        } catch (error) {
            keys = 0;
        }

        if (!keys || getCollectionLength(keys) === 0) {
            try {
                keys = typeof property.getKeys === "function" ? property.getKeys() : 0;
                source = hasSelectedKeyApi ? "all-no-selected-keys" : "all-no-selection-api";
            } catch (fallbackError) {
                keys = 0;
            }
        }

        return {
            keys: collectionToArray(keys),
            source: source,
            hasSelectedKeyApi: hasSelectedKeyApi
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
        var interpolationApplied = false;

        if (typeof property.setInterpolationTypeAtKey === "function") {
            try {
                property.setInterpolationTypeAtKey(keyTime, KF_INTERP_MODE_BEZIER, 1);
                interpolationApplied = true;
            } catch (error) {
                if (!temporalApplied) {
                    throw error;
                }
            }
        }

        if (!temporalApplied && !interpolationApplied) {
            throw new Error("Parametro sem metodo de interpolacao temporal disponivel.");
        }

        return {
            temporalApplied: temporalApplied,
            interpolationApplied: interpolationApplied
        };
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
            temporalEaseApplied: 0,
            interpolationApplied: 0,
            selectionLimitedProperties: 0,
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
        var applyResult;
        var propertyName;

        if (!isExpectedPremiereVersion()) {
            result.message = "Este build exige Premiere Pro " + EXPECTED_PREMIERE_VERSION + ". Host atual: " + app.version + ".";
            return result;
        }

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

                        if (targetKeys.source !== "selected") {
                            propertyName = getPropertyName(property, "propriedade");

                            if (targetKeys.source === "all-no-selection-api") {
                                result.selectionLimitedProperties += 1;
                                result.warnings.push(
                                    "A API publica do Premiere nao expoe selecao individual de keyframes para "
                                    + propertyName
                                    + "; aplicando em todos os keyframes do parametro."
                                );
                            } else {
                                result.warnings.push(
                                    "Nenhum keyframe selecionado foi detectado em "
                                    + propertyName
                                    + "; aplicando em todos os keyframes do parametro."
                                );
                            }
                        }

                        result.properties += 1;

                        for (keyIndex = 0; keyIndex < targetKeys.keys.length; keyIndex += 1) {
                            keyTime = targetKeys.keys[keyIndex];
                            applyResult = applyEaseToKey(property, keyTime, ease);
                            result.keys += 1;
                            result.applied += 1;

                            if (applyResult.temporalApplied) {
                                result.temporalEaseApplied += 1;
                            }

                            if (applyResult.interpolationApplied) {
                                result.interpolationApplied += 1;
                            }

                            if (!applyResult.temporalApplied && applyResult.interpolationApplied) {
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
        if (result.ok && result.temporalEaseApplied === 0) {
            result.message = "Interpolacao Bezier aplicada aos keyframes encontrados. Speed/Influence numerico nao foi alterado porque a API do Premiere nao expos esse ajuste para estes parametros.";
        } else {
            result.message = result.ok
                ? "Ease temporal aplicado aos keyframes encontrados."
                : "Nenhum parametro keyframado foi encontrado nos clips selecionados.";
        }

        if (result.fallbacks > 0) {
            result.warnings.push(
                "Premiere Pro nao disponibilizou setTemporalEaseAtKey para todos os parametros; foi aplicada interpolacao Bezier quando possivel."
            );
        }

        return result;
    }

    function bakeCurve(payload) {
        var result = {
            ok: false,
            message: "",
            applied: 0,
            clips: 0,
            components: 0,
            properties: 0,
            keys: 0,
            bakedKeys: 0,
            intervals: 0,
            removedKeys: 0,
            unsupportedProperties: 0,
            linearizedKeys: 0,
            selectionLimitedProperties: 0,
            warnings: []
        };
        var curve = normalizeCurve(payload && payload.curve);
        var bake = normalizeBakeOptions(payload && payload.bake);
        var sequence;
        var selectedClips;
        var clipIndex;
        var componentIndex;
        var propertyIndex;
        var keyIndex;
        var sampleIndex;
        var clip;
        var components;
        var component;
        var properties;
        var property;
        var propertyName;
        var targetKeys;
        var keys;
        var startKey;
        var endKey;
        var startSeconds;
        var endSeconds;
        var duration;
        var startValue;
        var endValue;
        var sampleX;
        var sampleY;
        var sampleTime;
        var sampleValue;

        if (!isExpectedPremiereVersion()) {
            result.message = "Este build exige Premiere Pro " + EXPECTED_PREMIERE_VERSION + ". Host atual: " + app.version + ".";
            return result;
        }

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
                    propertyName = getPropertyName(property, "propriedade");

                    try {
                        if (typeof property.isTimeVarying === "function" && property.isTimeVarying() !== true) {
                            continue;
                        }

                        targetKeys = getTargetKeys(property);
                        keys = sortKeysByTime(targetKeys.keys);

                        if (keys.length < 2) {
                            continue;
                        }

                        if (targetKeys.source === "all-no-selection-api") {
                            result.selectionLimitedProperties += 1;
                            result.warnings.push(
                                "A API publica do Premiere nao expoe selecao individual de keyframes para "
                                + propertyName
                                + "; o bake usara o primeiro e o ultimo keyframe do parametro."
                            );
                        } else if (targetKeys.source === "all-no-selected-keys") {
                            result.warnings.push(
                                "Nenhum keyframe selecionado foi detectado em "
                                + propertyName
                                + "; o bake usara o primeiro e o ultimo keyframe do parametro."
                            );
                        }

                        if (keys.length > 2 && !bake.replaceInteriorKeys) {
                            result.unsupportedProperties += 1;
                            result.warnings.push(
                                "Bake ignorado em "
                                + propertyName
                                + " porque existem keyframes internos. Ative Recriar intervalo para substituir esses keyframes."
                            );
                            continue;
                        }

                        startKey = keys[0];
                        endKey = keys[keys.length - 1];
                        startSeconds = timeToSeconds(startKey);
                        endSeconds = timeToSeconds(endKey);
                        duration = endSeconds - startSeconds;

                        if (!isFinite(startSeconds) || !isFinite(endSeconds) || duration <= 0) {
                            result.unsupportedProperties += 1;
                            result.warnings.push("Bake ignorado em " + propertyName + " por tempos de keyframe invalidos.");
                            continue;
                        }

                        startValue = getValueAtKeyTime(property, startKey);
                        endValue = getValueAtKeyTime(property, endKey);

                        if (interpolateValue(startValue, endValue, 0.5) === null) {
                            result.unsupportedProperties += 1;
                            result.warnings.push(
                                "Bake ignorado em "
                                + propertyName
                                + " porque os valores nao sao numericos ou vetores numericos compativeis."
                            );
                            continue;
                        }

                        result.properties += 1;
                        result.keys += keys.length;

                        if (bake.replaceInteriorKeys) {
                            for (keyIndex = keys.length - 2; keyIndex >= 1; keyIndex -= 1) {
                                if (typeof property.removeKey === "function") {
                                    try {
                                        property.removeKey(keys[keyIndex]);
                                        result.removedKeys += 1;
                                    } catch (removeError) {
                                        result.warnings.push(
                                            "Nao foi possivel remover keyframe interno em "
                                            + propertyName
                                            + ": "
                                            + removeError
                                        );
                                    }
                                }
                            }
                        }

                        if (setInterpolationMode(property, startKey, KF_INTERP_MODE_LINEAR)) {
                            result.linearizedKeys += 1;
                        }

                        if (setInterpolationMode(property, endKey, KF_INTERP_MODE_LINEAR)) {
                            result.linearizedKeys += 1;
                        }

                        for (sampleIndex = 1; sampleIndex <= bake.samples; sampleIndex += 1) {
                            sampleX = sampleIndex / (bake.samples + 1);
                            sampleY = curveYAtX(sampleX, curve);
                            sampleTime = createTimeFromSeconds(startSeconds + duration * sampleX);
                            sampleValue = interpolateValue(startValue, endValue, sampleY);

                            setBakedValueAtKey(property, sampleTime, sampleValue);

                            if (setInterpolationMode(property, sampleTime, KF_INTERP_MODE_LINEAR)) {
                                result.linearizedKeys += 1;
                            }

                            result.bakedKeys += 1;
                            result.applied += 1;
                        }

                        result.intervals += 1;
                    } catch (propertyError) {
                        result.warnings.push(
                            "Falha no bake em "
                            + propertyName
                            + ": "
                            + propertyError
                        );
                    }
                }
            }
        }

        result.ok = result.bakedKeys > 0;
        result.message = result.ok
            ? "Bake Curve gerou keyframes intermediarios seguindo a curva desenhada."
            : "Nenhum parametro compativel foi encontrado para Bake Curve.";

        if (result.ok) {
            result.warnings.push(
                "Bake Curve e uma simulacao: ele cria keyframes lineares intermediarios entre o primeiro e o ultimo keyframe."
            );
        }

        return result;
    }

    function scaleValue(value, factor) {
        var next = [];
        var index;

        if (typeof value === "number") {
            return value * factor;
        }

        if (value instanceof Array) {
            for (index = 0; index < value.length; index += 1) {
                next.push(typeof value[index] === "number" ? value[index] * factor : value[index]);
            }

            return next;
        }

        return 100 * factor;
    }

    function recordAnimationKey(property, keyTime, value, label, result) {
        if (property && setAnimationKey(property, keyTime, value)) {
            result.applied += 1;
            pushUnique(result.animatedProperties, label);
            return true;
        }

        return false;
    }

    function getTrackItemStartTime(trackItem, sequence) {
        if (trackItem && trackItem.start) {
            return trackItem.start;
        }

        if (sequence && typeof sequence.getPlayerPosition === "function") {
            return sequence.getPlayerPosition();
        }

        return createTimeFromSeconds(0);
    }

    function getTrackItemDurationSeconds(trackItem) {
        var duration;
        var start;
        var end;

        try {
            duration = timeToSeconds(trackItem.duration);
            if (isFinite(duration) && duration > 0) {
                return duration;
            }
        } catch (durationError) {
            // Fall back to end minus start.
        }

        try {
            start = timeToSeconds(trackItem.start);
            end = timeToSeconds(trackItem.end);
            duration = end - start;
        } catch (rangeError) {
            duration = NaN;
        }

        return isFinite(duration) && duration > 0 ? duration : 0;
    }

    function applyTransformAnimation(trackItem, sequence, payload, startTime, result) {
        var scaleParam = findComponentParam(trackItem, ["scale", "escala"], ["ae adbe motion", "motion", "movimento"]);
        var positionParam = findComponentParam(trackItem, ["position", "posicao"], ["ae adbe motion", "motion", "movimento"]);
        var opacityParam = findComponentParam(trackItem, ["opacity", "opacidade"], ["ae adbe opacity", "opacity", "opacidade"]);
        var revealParam = findMgtParam(trackItem, ["progress", "progresso", "reveal", "typewriter", "typing"]);
        var recipe = payload.recipe || {};
        var baseScale = currentParamValue(scaleParam, 100);
        var basePosition = currentParamValue(positionParam, [0.5, 0.5]);
        var baseOpacity = currentParamValue(opacityParam, 100);
        var clipDuration = getTrackItemDurationSeconds(trackItem);
        var animationDuration = clipDuration > 0 ? Math.min(payload.duration, clipDuration) : payload.duration;
        var start;
        var mid;
        var end;
        var late;
        var opacityEndTime;

        start = startTime;
        mid = timeOffset(startTime, animationDuration * 0.65);
        late = timeOffset(startTime, animationDuration * 0.18);
        end = timeOffset(startTime, animationDuration);

        if (recipe.scaleStart !== null && recipe.scaleStart !== undefined && scaleParam) {
            recordAnimationKey(scaleParam, start, scaleValue(baseScale, recipe.scaleStart / 100), "Scale", result);

            if (recipe.scaleOvershoot !== null && recipe.scaleOvershoot !== undefined && recipe.scaleOvershoot !== 100) {
                recordAnimationKey(scaleParam, mid, scaleValue(baseScale, recipe.scaleOvershoot / 100), "Scale", result);
            }

            recordAnimationKey(scaleParam, end, baseScale, "Scale", result);
        }

        if (recipe.positionYOffset !== null && recipe.positionYOffset !== undefined && recipe.positionYOffset !== 0 && positionParam) {
            recordAnimationKey(positionParam, start, addPositionOffset(basePosition, 0, recipe.positionYOffset, sequence), "Position", result);
            recordAnimationKey(positionParam, end, basePosition, "Position", result);
        }

        if (recipe.reveal) {
            if (revealParam) {
                recordAnimationKey(revealParam, start, 0, "Reveal", result);
                recordAnimationKey(revealParam, end, 100, "Reveal", result);
            } else if (payload.type === "typewriter" || payload.type === "custom") {
                result.warnings.push(
                    "Typewriter real exige um parametro Reveal/Progress exposto no texto selecionado; aplicando fade como fallback."
                );
            }
        }

        if (recipe.opacityStart !== null && recipe.opacityStart !== undefined && opacityParam) {
            opacityEndTime = end;

            if (payload.type === "pop-in" || payload.type === "typewriter") {
                opacityEndTime = late;
            } else if (payload.type === "slide-up") {
                opacityEndTime = mid;
            }

            recordAnimationKey(opacityParam, start, recipe.opacityStart, "Opacity", result);
            recordAnimationKey(opacityParam, opacityEndTime, baseOpacity || 100, "Opacity", result);
        }
    }

    function applyTextAnimation(payload) {
        var result = {
            ok: false,
            message: "",
            applied: 0,
            clips: 0,
            properties: 0,
            animationType: "",
            target: "selection",
            presetName: "",
            clipName: "",
            animatedProperties: [],
            warnings: []
        };
        var sequence;
        var textPayload = normalizeTextAnimationPayload(payload);
        var selectedClips;
        var clipIndex;
        var trackItem;
        var startTime;
        var beforeApplied;

        if (!isExpectedPremiereVersion()) {
            result.message = "Este build exige Premiere Pro " + EXPECTED_PREMIERE_VERSION + ". Host atual: " + app.version + ".";
            return result;
        }

        result.animationType = textPayload.type;
        result.presetName = textPayload.presetName;

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
            result.message = "Selecione um texto ou graphic clip na timeline antes de aplicar a animacao.";
            return result;
        }

        result.clips = selectedClips.length;

        for (clipIndex = 0; clipIndex < selectedClips.length; clipIndex += 1) {
            trackItem = selectedClips[clipIndex];
            startTime = getTrackItemStartTime(trackItem, sequence);
            beforeApplied = result.applied;

            if (!result.clipName) {
                result.clipName = trackItem.name || "Texto selecionado";
            }

            try {
                applyTransformAnimation(trackItem, sequence, textPayload, startTime, result);
            } catch (animationError) {
                result.warnings.push(
                    "Falha ao aplicar animacao em "
                    + (trackItem.name || "clip selecionado")
                    + ": "
                    + animationError
                );
            }

            if (beforeApplied === result.applied) {
                result.warnings.push(
                    "O item selecionado "
                    + (trackItem.name || "clip")
                    + " nao expos Scale, Position, Opacity ou Reveal para keyframes."
                );
            }
        }

        result.properties = result.animatedProperties.length;
        result.ok = result.applied > 0;
        result.message = result.applied > 0
            ? "Animacao aplicada ao texto ou graphic clip selecionado."
            : "Nenhum parametro animavel foi encontrado nos itens selecionados.";

        if (result.applied === 0) {
            result.warnings.push("Selecione um texto/graphic clip que exponha Scale, Position, Opacity ou Reveal.");
        }

        return result;
    }

    function normalizeFsPath(path) {
        return String(path || "").replace(/\//g, "\\").toLowerCase();
    }

    function findProjectItemByPath(projectItem, absoluteFilePath) {
        var targetPath = normalizeFsPath(absoluteFilePath);
        var children;
        var childIndex;
        var child;
        var found;

        if (!projectItem) {
            return null;
        }

        if (typeof projectItem.getMediaPath === "function") {
            try {
                if (normalizeFsPath(projectItem.getMediaPath()) === targetPath) {
                    return projectItem;
                }
            } catch (mediaPathError) {
                // Bins and offline items may not expose a media path.
            }
        }

        children = collectionToArray(projectItem.children);

        for (childIndex = 0; childIndex < children.length; childIndex += 1) {
            child = children[childIndex];
            found = findProjectItemByPath(child, absoluteFilePath);

            if (found) {
                return found;
            }
        }

        return null;
    }

    function getSequencePlayheadTime(sequence) {
        if (sequence && typeof sequence.getPlayerPosition === "function") {
            return sequence.getPlayerPosition();
        }

        if (sequence && typeof sequence.getCTI === "function") {
            return sequence.getCTI();
        }

        throw new Error("Nao foi possivel localizar o CTI da sequencia.");
    }

    function findAvailableAudioTrack(sequence) {
        var tracks = sequence && sequence.audioTracks;
        var length = getCollectionLength(tracks);
        var index;
        var track;
        var locked;

        for (index = 0; index < length; index += 1) {
            track = getCollectionItem(tracks, index);
            locked = false;

            if (!track) {
                continue;
            }

            try {
                if (typeof track.isLocked === "function") {
                    locked = track.isLocked() === true;
                } else if (typeof track.isLocked === "boolean") {
                    locked = track.isLocked;
                }
            } catch (lockError) {
                locked = false;
            }

            if (!locked && (typeof track.overwriteClip === "function" || typeof track.insertClip === "function")) {
                return {
                    track: track,
                    index: index
                };
            }
        }

        return null;
    }

    function timeToTicksString(time) {
        var seconds;

        if (time && time.ticks !== undefined) {
            return String(time.ticks);
        }

        seconds = timeToSeconds(time);

        if (!isFinite(seconds)) {
            throw new Error("Tempo invalido para insercao de audio.");
        }

        return String(Math.round(seconds * TICKS_PER_SECOND));
    }

    function insertAudioProjectItem(sequence, trackResult, projectItem, playheadTime) {
        var ticks = timeToTicksString(playheadTime);
        var insertResult;

        if (typeof trackResult.track.overwriteClip === "function") {
            insertResult = trackResult.track.overwriteClip(projectItem, ticks);
            return insertResult !== false;
        }

        if (typeof sequence.insertClip === "function") {
            insertResult = sequence.insertClip(projectItem, playheadTime, 0, trackResult.index);
            return insertResult === true;
        }

        if (typeof trackResult.track.insertClip === "function") {
            trackResult.track.insertClip(projectItem, ticks, 0, trackResult.index);
            return true;
        }

        return false;
    }

    function importAndInsertAudio(absoluteFilePath) {
        var result = {
            ok: false,
            message: "",
            filePath: String(absoluteFilePath || ""),
            projectItemName: "",
            audioTrack: -1,
            imported: false,
            inserted: false,
            warnings: []
        };
        var sourceFile = new File(result.filePath);
        var sequence;
        var projectItem;
        var importResult;
        var trackResult;
        var playheadTime;

        if (!isExpectedPremiereVersion()) {
            result.message = "Este build exige Premiere Pro " + EXPECTED_PREMIERE_VERSION + ". Host atual: " + app.version + ".";
            return result;
        }

        if (!result.filePath || !sourceFile.exists) {
            result.message = "Arquivo de audio nao encontrado: " + result.filePath;
            return result;
        }

        try {
            sequence = app.project && app.project.activeSequence;
        } catch (sequenceError) {
            sequence = null;
        }

        if (!sequence) {
            result.message = "Nenhuma sequencia ativa encontrada.";
            return result;
        }

        result.filePath = sourceFile.fsName;
        projectItem = findProjectItemByPath(app.project.rootItem, result.filePath);

        if (!projectItem) {
            try {
                importResult = app.project.importFiles([sourceFile.fsName], true, app.project.rootItem, false);
                result.imported = importResult === true;
            } catch (importError) {
                result.message = "Falha ao importar o audio: " + importError;
                return result;
            }

            projectItem = findProjectItemByPath(app.project.rootItem, result.filePath);
        }

        if (!projectItem) {
            result.message = "O Premiere importou o arquivo, mas o ProjectItem nao foi localizado.";
            return result;
        }

        result.projectItemName = projectItem.name || sourceFile.name;
        trackResult = findAvailableAudioTrack(sequence);

        if (!trackResult) {
            result.message = "Nenhuma track de audio desbloqueada foi encontrada na sequencia.";
            return result;
        }

        try {
            playheadTime = getSequencePlayheadTime(sequence);
            result.inserted = insertAudioProjectItem(sequence, trackResult, projectItem, playheadTime);
            result.audioTrack = trackResult.index;

            if (!result.inserted) {
                throw new Error("O Premiere recusou a insercao na faixa de audio.");
            }
        } catch (insertError) {
            result.message = "Audio importado, mas falhou ao inserir na timeline: " + insertError;
            return result;
        }

        result.ok = true;
        result.message = "Audio importado e inserido no CTI da sequencia.";
        return result;
    }

    function getRuntimeInfo() {
        var sequence = null;
        var selection = [];
        var projectName = "";
        var sequenceName = "";
        var appName = "Premiere Pro";

        try {
            appName = app.name || appName;
            projectName = app.project ? app.project.name : "";
            sequence = app.project && app.project.activeSequence;
            sequenceName = sequence ? sequence.name : "";

            if (sequence && typeof sequence.getSelection === "function") {
                selection = collectionToArray(sequence.getSelection());
            }
        } catch (error) {
            return {
                ok: false,
                compatible: false,
                expectedVersion: EXPECTED_PREMIERE_VERSION,
                appVersion: String(app.version || ""),
                appName: appName,
                projectName: projectName,
                sequenceName: sequenceName,
                selectedClips: 0,
                message: "Falha ao consultar o runtime do Premiere: " + error,
                warnings: []
            };
        }

        return {
            ok: isExpectedPremiereVersion(),
            compatible: isExpectedPremiereVersion(),
            expectedVersion: EXPECTED_PREMIERE_VERSION,
            appVersion: String(app.version || ""),
            appName: appName,
            projectName: projectName,
            sequenceName: sequenceName,
            selectedClips: selection.length,
            message: isExpectedPremiereVersion()
                ? "Runtime Premiere Pro 26.2.2 validado."
                : "Versao incompativel do Premiere Pro.",
            warnings: []
        };
    }

    function safeJsonCall(callback) {
        try {
            return stringifyJson(callback());
        } catch (error) {
            return stringifyJson({
                ok: false,
                message: "Falha interna no host JSX: " + error,
                warnings: []
            });
        }
    }

    $.global.ThomadosFunBox = {
        ping: function () {
            return safeJsonCall(getRuntimeInfo);
        },

        getRuntimeInfo: function () {
            return safeJsonCall(getRuntimeInfo);
        },

        applyTemporalEase: function (payload) {
            return safeJsonCall(function () {
                return applyTemporalEase(payload);
            });
        },

        bakeCurve: function (payload) {
            return safeJsonCall(function () {
                return bakeCurve(payload);
            });
        },

        applyTextAnimation: function (payload) {
            return safeJsonCall(function () {
                return applyTextAnimation(payload);
            });
        },

        importAndInsertAudio: function (absoluteFilePath) {
            return safeJsonCall(function () {
                return importAndInsertAudio(absoluteFilePath);
            });
        }
    };

    $.global.thomadosFunBox_ping = function () {
        return $.global.ThomadosFunBox.ping();
    };

    $.global.thomadosFunBox_getRuntimeInfo = function () {
        return $.global.ThomadosFunBox.getRuntimeInfo();
    };

    $.global.thomadosFunBox_applyTemporalEase = function (payload) {
        return $.global.ThomadosFunBox.applyTemporalEase(payload);
    };

    $.global.thomadosFunBox_bakeCurve = function (payload) {
        return $.global.ThomadosFunBox.bakeCurve(payload);
    };

    $.global.thomadosFunBox_applyTextAnimation = function (payload) {
        return $.global.ThomadosFunBox.applyTextAnimation(payload);
    };

    $.global.thomadosFunBox_importAndInsertAudio = function (absoluteFilePath) {
        return $.global.ThomadosFunBox.importAndInsertAudio(absoluteFilePath);
    };
}());
