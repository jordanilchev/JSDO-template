/* Copyright (c) 2012-2015 Progress Software Corporation and/or its subsidiaries or affiliates.
 * All rights reserved.
 *
 * Redistributable Code.
 *
 */

// Version: 4.0.0-09

/*
 * progress.session.js
 */


(function () {

    /* define these if not defined yet - they may already be defined if
     progress.js was included first */
    if (typeof progress == 'undefined')
        progress = {};
    if (typeof progress.data == 'undefined')
        progress.data = {};

    progress.data.ServicesManager = {};
    progress.data.ServicesManager._services = [];
    progress.data.ServicesManager._resources = [];
    progress.data.ServicesManager._data = [];
    progress.data.ServicesManager._sessions = [];
    /*
     progress.data.ServicesManager.put = function(id, jsdo) {
     progress.data.ServicesManager._data[id] = jsdo;
     };
     progress.data.ServicesManager.get = function(id) {
     return progress.data.ServicesManager._data[id];
     };
     */

    progress.data.ServicesManager.addResource = function (id, resource) {
        if (progress.data.ServicesManager._resources[id] === undefined)
            progress.data.ServicesManager._resources[id] = resource;
        else
            throw new Error("A resource named '" + id + "' was already loaded.");
    };
    progress.data.ServicesManager.getResource = function (id) {
        return progress.data.ServicesManager._resources[id];
    };
    progress.data.ServicesManager.addService = function (id, service) {
        if (progress.data.ServicesManager._services[id] === undefined)
            progress.data.ServicesManager._services[id] = service;
        else
            throw new Error("A service named '" + id + "' was already loaded.");
    };
    progress.data.ServicesManager.getService = function (id) {
        return progress.data.ServicesManager._services[id];
    };
    progress.data.ServicesManager.addSession = function (catalogURI, session) {
        if (progress.data.ServicesManager._sessions[catalogURI] === undefined)
            progress.data.ServicesManager._sessions[catalogURI] = session;
        else
            throw new Error("Cannot load catalog '" + catalogURI + "' multiple times.");
    };
    progress.data.ServicesManager.getSession = function (catalogURI) {
        try {
            return progress.data.ServicesManager._sessions[catalogURI];
        }
        catch (e) {
            return null;
        }
    };

    /*
     * Scans URL for parameters of the form {name}
     * Returns array with the names
     */
    function extractParamsFromURL(url) {
        var urlParams = [];
        if (typeof(url) == 'string') {
            var paramName = null;
            for (var i = 0; i < url.length; i++) {
                if (url.charAt(i) == '{') {
                    paramName = "";
                }
                else if (url.charAt(i) == '}') {
                    if (paramName)
                        urlParams.push(paramName);
                    paramName = null;
                }
                else if (paramName !== null) {
                    paramName += url.charAt(i);
                }
            }
        }
        return urlParams;
    }

    /*
     * Adds the catalog.json file provided by the catalog parameter, which is a JSDO
     * that has loaded the catalog
     */
    progress.data.ServicesManager.addCatalog = function (services, session) {
        if (!services) {
            throw new Error("Cannot find 'services' property in catalog file.");
        }
        if (services instanceof Array) {

            // first check if there are duplicates before we add them to our cache,
            // which only handles unique values
            for (var j = 0; j < services.length; j++) {
                // don't allow services with the same name across sessions
                if (progress.data.ServicesManager.getService(services[j].name) !== undefined)
                    throw new Error("A service named '" + services[j].name + "' was already loaded.");

                var resources = services[j].resources;

                if (resources instanceof Array) {
                    for (var i = 0; i < resources.length; i++) {
                        if (progress.data.ServicesManager.getResource(resources[i].name) !== undefined)
                            throw new Error("A resource named '" + resources[i].name + 
                                "' was already loaded.");
                    }
                }
                else {
                    throw new Error("Missing 'resources' array in catalog.");
                }
            }

            for (var j = 0; j < services.length; j++) {
                services[j]._session = session;
                this.addService(services[j].name, services[j]); // Register the service
                var resources = services[j].resources;
                var baseAddress = services[j].address;
                if (resources instanceof Array) {
                    for (var i = 0; i < resources.length; i++) {
                        var resource = resources[i];
                        resource.fn = {};
                        resource.service = services[j];
                        resources[i].url = baseAddress + resources[i].path;
                        // Register resource
                        progress.data.ServicesManager.addResource(resources[i].name, resources[i]);

                        // Process schema
                        resource.fields = null;
                        resource.primaryKeys = null;
                        if (resource.schema) {
                            resource.fields = {};
                            resource.primaryKeys = {};
                            resource._dataSetName = undefined;
                            resource._tempTableName = undefined;
                            var properties = null;

                            try {
                                if (typeof resource.schema.properties != 'undefined') {
                                    var keys = Object.keys(resource.schema.properties);
                                    properties = resource.schema.properties;
                                    if (keys.length == 1) {
                                        if (typeof resource.schema.properties[keys[0]].properties != 
                                            'undefined') {
                                            // Schema corresponds to a DataSet
                                            resource._dataSetName = keys[0];
                                        }
                                        else if (typeof resource.schema.properties[keys[0]].items != 
                                            'undefined') {
                                            // Schema corresponds to a temp-table
                                            resource.dataProperty = keys[0];
                                            properties = resource.schema.properties[keys[0]].items.properties;
                                            resource._tempTableName = resource.dataProperty;
                                            resource.primaryKeys[resource._tempTableName] = 
                                                resource.schema.properties[keys[0]].primaryKey;
                                        }
                                    }
                                }
                                else {
                                    var keys = Object.keys(resource.schema);
                                    if (keys.length == 1) {
                                        resource.dataProperty = keys[0];
                                        if (typeof resource.schema[keys[0]].items != 'undefined') {
                                            // Catalog format correspond to Table Schema
                                            properties = resource.schema[keys[0]].items.properties;
                                            resource._tempTableName = resource.dataProperty;
                                            resource.primaryKeys[resource._tempTableName] = 
                                                resource.schema[keys[0]].primaryKey;
                                        }
                                        else if (typeof resource.schema[keys[0]].properties != 'undefined') {
                                            // Catalog format correspond to DataSet Schema
                                            resource._dataSetName = keys[0];
                                            resource.dataProperty = null;
                                            properties = resource.schema;
                                        }
                                    }
                                }
                            }
                            catch (e) {
                                throw new Error("Error parsing catalog file.");
                            }
                            if (properties) {
                                if (resource._dataSetName) {
                                    properties = properties[resource._dataSetName].properties;
                                    for (var tableName in properties) {
                                        resource.fields[tableName] = [];
                                        resource.primaryKeys[tableName] = properties[tableName].primaryKey;
                                        var tableProperties;
                                        if (properties[tableName].items
                                            && properties[tableName].items.properties) {
                                            tableProperties = properties[tableName].items.properties;
                                        }
                                        else {
                                            tableProperties = properties[tableName].properties;
                                        }
                                        for (var field in tableProperties) {
                                            tableProperties[field].name = field;
                                            if (field != '_id')
                                                resource.fields[tableName].push(tableProperties[field]);
                                        }
                                    }
                                }
                                else {
                                    var tableName = resource.dataProperty ? resource.dataProperty : "";
                                    resource.fields[tableName] = [];
                                    for (var field in properties) {
                                        properties[field].name = field;
                                        if (field != '_id')
                                            resource.fields[tableName].push(properties[field]);
                                    }
                                }
                            }
                            else
                                throw new Error("Error parsing catalog file.");
                        }
                        else
                            resource.fields = null;

                        // Validate relationship property
                        if ((resource.relations instanceof Array)
                            && resource.relations[0]
                            && resource.relations[0].RelationName) {
                            throw new Error(
                                "Relationship properties in catalog must begin with lowercase.");
                        }
                        // Process operations
                        resource.generic = {};
                        if (resource.operations) {
                            for (var idx = 0; idx < resource.operations.length; idx++) {
                                if (resource.operations[idx].path) {
                                    resource.operations[idx].url = 
                                        resource.url + resource.operations[idx].path;
                                }
                                else {
                                    resource.operations[idx].url = resource.url;
                                }
                                if (!resource.operations[idx].params) {
                                    resource.operations[idx].params = [];
                                }
                                if (!resource.operations[idx].type) {
                                    resource.operations[idx].type = "INVOKE";
                                }

                                // Set opname - validation of opname is done later
                                var opname = resource.operations[idx].type.toLowerCase();

                                // Set default verb based on operation
                                if (!resource.operations[idx].verb) {
                                    switch (opname) {
                                        case 'create':
                                            resource.operations[idx].verb = "POST";
                                            break;
                                        case 'read':
                                            resource.operations[idx].verb = "GET";
                                            break;
                                        case 'update':
                                        case 'invoke':
                                        case 'submit':
                                            resource.operations[idx].verb = "PUT";
                                            break;
                                        case 'delete':
                                            resource.operations[idx].verb = "DELETE";
                                            break;
                                        default:
                                            break;
                                    }
                                }

                                // Point fn to operations
                                var func = function fn(object, async) {
                                    var deferred;
                                    
                                    // Add static variable fnName to function
                                    if (typeof fn.fnName == 'undefined') {
                                        fn.fnName = arguments[0]; // Name of function
                                        fn.definition = arguments[1]; // Operation definition
                                        return;
                                    }
                                                                        
                                    var reqBody = null;
                                    var url = fn.definition.url;
                                    var jsdo = this;
                                    var xhr = null;

                                    var request = {};
                                    if (object) {
                                        if (typeof(object) != "object") {
                                            throw new Error("Catalog error: Function '" + 
                                                fn.fnName + "' requires an object as a parameter.");
                                        }
                                        var objParam;
                                        if (object instanceof XMLHttpRequest) {
                                            jsdo = object.jsdo;
                                            xhr = object;
                                            objParam = xhr.objParam;

                                            // use the request from the xhr request if possible
                                            request = xhr.request;
                                        }
                                        else {
                                            objParam = object;
                                        }

                                        if (typeof async == 'undefined') {
                                            async = this._async;
                                        }
                                        else {
                                            async = Boolean(async);
                                        }

                                        request.objParam = objParam;
                                        

                                        // Process objParam
                                        var isInvoke = (fn.definition.type.toUpperCase() == 'INVOKE');
                                        for (var i = 0; i < fn.definition.params.length; i++) {
                                            var name = fn.definition.params[i].name;
                                            switch (fn.definition.params[i].type) {
                                                case 'PATH':
                                                case 'QUERY':
                                                case 'MATRIX':
                                                    var value = null;
                                                    if (objParam)
                                                        value = objParam[name];
                                                    if (!value)
                                                        value = "";
                                                    if (url.indexOf('{' + name + '}') == -1) {
                                                        throw new Error("Catalog error: Reference to " + 
                                                            fn.definition.params[i].type + " parameter '" + 
                                                            name + "' is missing in path.");
                                                    }
                                                    url = url.replace(
                                                        new RegExp('{' + name + '}', 'g'),
                                                        encodeURIComponent(value));
                                                    break;
                                                case 'REQUEST_BODY':
                                                case 'REQUEST_BODY,RESPONSE_BODY':
                                                case 'RESPONSE_BODY,REQUEST_BODY':
                                                    if (xhr && !reqBody) {
                                                        reqBody = objParam;
                                                    }
                                                    else {
                                                        var reqParam = objParam[name];
                                                        if (isInvoke
                                                            && (fn.definition.params[i].xType 
                                                            && ("DATASET,TABLE".indexOf(
                                                                fn.definition.params[i].xType) != -1))) {
                                                            var unwrapped = (jsdo._resource.service.settings 
                                                                && jsdo._resource.service.settings.unwrapped);
                                                            if (unwrapped) {
                                                                // Remove extra level if found
                                                                if ((typeof(reqParam) == 'object')
                                                                    && (Object.keys(reqParam).length == 1)
                                                                    && (typeof(reqParam[name]) == 'object'))
                                                                    reqParam = reqParam[name];
                                                            }
                                                            else {
                                                                // Add extra level if not found
                                                                if ((typeof(reqParam) == 'object')
                                                                    && (typeof(reqParam[name])=='undefined')){
                                                                    reqParam = {};
                                                                    reqParam[name] = objParam[name];
                                                                }
                                                            }
                                                        }
                                                        if (!reqBody) {
                                                            reqBody = {};
                                                        }
                                                        reqBody[name] = reqParam;
                                                    }
                                                    break;
                                                case 'RESPONSE_BODY':
                                                    break;
                                                default:
                                                    throw new Error("Catalog error: " + 
                                                        "Unexpected parameter type '" + 
                                                        fn.definition.params[i].type + "'.");
                                            }
                                        }

                                        // URL has parameters
                                        if (url.indexOf('{') != -1) {
                                            var paramsFromURL = extractParamsFromURL(url);
                                            for (var i = 0; i < paramsFromURL.length; i++) {
                                                var name = paramsFromURL[i];
                                                var value = null;
                                                if (objParam)
                                                    value = objParam[name];
                                                if (!value)
                                                    value = "";
                                                url = url.replace(
                                                    new RegExp('{' + name + '}', 'g'),
                                                    encodeURIComponent(value));
                                            }
                                        }
                                    }

                                    request.fnName = fn.fnName;
                                    request.async = async;
                                    
                                    if (request.deferred === undefined &&
                                        typeof($) == 'function' && typeof($.Deferred) == 'function') {
                                        deferred = $.Deferred();
                                        request.deferred = deferred;
                                    }

                                    var data = jsdo._httpRequest(xhr, fn.definition.verb, 
                                        url, reqBody, request, async);
                                    return data;
                                };
                                // End of Function Definition

                                switch (resource.operations[idx].verb.toLowerCase()) {
                                    case 'get':
                                    case 'post':
                                    case 'put':
                                    case 'delete':
                                        break;
                                    default:
                                        throw new Error("Catalog error: Unexpected HTTP verb '" + 
                                            resource.operations[idx].verb + 
                                            "' found while parsing the catalog.");
                                }

                                switch (opname) {
                                    case 'invoke':
                                        break;
                                    case 'create':
                                    case 'read':
                                    case 'update':
                                    case 'delete':
                                    case 'submit':
                                        if (typeof(resource.generic[opname]) == "function") {
                                            throw new Error("Catalog error: Multiple '" + 
                                                resource.operations[idx].type + 
                                                "' operations specified in the catalog for resource '" + 
                                                resource.name + "'.");
                                        }
                                        else
                                            resource.generic[opname] = func;
                                        break;
                                    default:
                                        throw new Error("Catalog error: Unexpected operation '" + 
                                            resource.operations[idx].type + 
                                            "' found while parsing the catalog.");
                                }

                                // Set fnName
                                var name = resource.operations[idx].name;
                                if (opname == "invoke") {
                                    resource.fn[name] = {};
                                    resource.fn[name]["function"] = func;
                                }
                                else {
                                    name = "_" + opname;
                                }
                                func(name, resource.operations[idx]);
                            }
                        }
                    }
                }
            }
        }
        else {
            throw new Error("Missing 'services' array in catalog.");
        }

    };

    /*
     * Prints debug information about the ServicesManager.
     */
    progress.data.ServicesManager.printDebugInfo = function (resourceName) {
        if (resourceName) {
            //console.log("** ServicesManager **");
            //console.log("** BEGIN **");
            var resource = progress.data.ServicesManager.getResource(resourceName);
            if (resource) {
                var cSchema = "Schema:\n";
                var cOperations = "Operations: " + resource.operations.length + "\n";
                for (var field in resource.schema.properties) {
                    cSchema += "\nName: " + field
                    + "\n";
                }

                for (var i = 0; i < resource.operations.length; i++) {
                    cOperations += "\n" + i
                    + "\nName: " + resource.operations[i].name
                    + "\nURL: " + resource.operations[i].url
                    + "\ntype: " + resource.operations[i].type
                    + "\nverb: " + resource.operations[i].verb
                    + "\nparams: " + resource.operations[i].params.length
                    + "\n";
                }
                console.log("** DEBUG INFO **\nResource name: %s\nURL:%s\n%s\n%s\n\n",
                    resource.name, resource.url, cSchema, cOperations);
            }
            else
                console.log("Resource not found");
            //console.log("** END **");
        }
    };


    /*
     * Contains information about a server-side Mobile service.
     * Properties of args parameter for constructor:
     * @param name   the name of the service
     * @param uri    the URI of the service
     */
    progress.data.MobileServiceObject = function MobileServiceObject(args) {
        var _name = args.name;
        Object.defineProperty(this, 'name',
            {
                get: function () {
                    return _name;
                },
                enumerable: true
            });

        var _uri = args.uri;
        Object.defineProperty(this, 'uri',
            {
                get: function () {
                    return _uri;
                },
                enumerable: true
            });
    };

    /*
     * Manages authentication and session ID information for a service.
     *
     * Use:  OE mobile developer instantiates a session and calls addCatalog() to load
     *       information for one or more services defined in a catalog file.
     *
     *       Developer instantiates JDSOs as needed.
     *       Usually all of the JSDOs will use the same session, but if a client-side
     *       service needs resources from more than one REST app, there would need to be more
     *       than one session
     *
     */
    progress.data.Session = function Session() {

        var defPropSupported = false;
        if ((typeof Object.defineProperty) == 'function') {
            defPropSupported = true;
        }

        var myself = this;
        var deviceIsOnline = true;  // online until proven offline
        var restApplicationIsOnline = false;  // was the Mobile Web Application
        // that this Session object connects to online
        // the last time it was checked?  (offline until logged in )
        var oepingAvailable = false;
        var defaultPartialPingURI = "/rest/_oeping";
        var partialPingURI = defaultPartialPingURI;

        this._onlineHandler = function () {
            deviceIsOnline = true;
            myself.trigger("online", myself, null);
        };

        this._offlineHandler = function () {
            deviceIsOnline = false;
            myself.trigger("offline", myself, progress.data.Session.DEVICE_OFFLINE, null);
        };

        if ((typeof window != 'undefined' ) && (window.addEventListener)) {
            window.addEventListener("online", this._onlineHandler, false);
            window.addEventListener("offline", this._offlineHandler, false);
        }


        /* constants and properties - define them as properties via the defineProperty()
         * function, which has "writable" and "configurable" parameters that both
         * default to false, so these calls create properties that are read-only
         *
         * IF WE DECIDE THAT WE CAN ASSUME WE ALWAYS RUN WITH A VERSION OF JAVASCRIPT THAT SUPPORTS
         * Object.DefineProperty(), WE CAN DELETE THE defPropSupported VARIABLE, THE TEST OF IT BELOW,
         * AND THE 'ELSE' CLAUSE BELOW AND ALL THE setXxxx functions (AND CHANGE THE CALLS TO THE setXxxx
         * FUNCTIONS SO THEY JUST REFER TO THE PROPERTY)
         *
         */

        // define these unconditionally so we don't get a warning on the push calls that they might
        // have been uninitialized
        var _catalogURIs = [];
        var _services = [];
        var _jsdos = [];

        this.onOpenRequest = null;

        var _password = null;

        if (defPropSupported) {
            var _userName = null;
            Object.defineProperty(this, 'userName',
                {
                    get: function () {
                        return _userName;
                    },
                    enumerable: true
                });

            var _loginTarget = '/static/home.html';
            Object.defineProperty(this, 'loginTarget',
                {
                    get: function () {
                        return _loginTarget;
                    },
                    enumerable: true
                });

            var _serviceURI = null;
            Object.defineProperty(this, 'serviceURI',
                {
                    get: function () {
                        return _serviceURI;
                    },
                    enumerable: true
                });

            Object.defineProperty(this, 'catalogURIs',
                {
                    get: function () {
                        return _catalogURIs;
                    },
                    enumerable: true
                });

            Object.defineProperty(this, 'services',
                {
                    get: function () {
                        return _services;
                    },
                    enumerable: true
                });

            var _loginResult = null;
            Object.defineProperty(this, 'loginResult',
                {
                    get: function () {
                        return _loginResult;
                    },
                    enumerable: true
                });

            var _loginHttpStatus = null;
            Object.defineProperty(this, 'loginHttpStatus',
                {
                    get: function () {
                        return _loginHttpStatus;
                    },
                    enumerable: true
                });

            var _clientContextId = null;
            Object.defineProperty(this, 'clientContextId',
                {
                    get: function () {
                        return _clientContextId;
                    },
                    enumerable: true
                });

            var _authenticationModel = progress.data.Session.AUTH_TYPE_ANON;
            Object.defineProperty(this, 'authenticationModel',
                {
                    get: function () {
                        return _authenticationModel;
                    },
                    set: function (newval) {
                        if (newval) {
                            newval = newval.toLowerCase();
                        }
                        switch (newval) {
                            case progress.data.Session.AUTH_TYPE_FORM :
                            case progress.data.Session.AUTH_TYPE_BASIC :
                            case progress.data.Session.AUTH_TYPE_ANON :
                            case null :
                                _authenticationModel = newval;
                                break;
                            default:
                                throw new Error("Error setting Session.authenticationModel. '" + 
                                    newval + "' is an invalid value.");
                        }
                    },
                    enumerable: true
                });

            var _lastSessionXHR = null;
            Object.defineProperty(this, 'lastSessionXHR',
                {
                    get: function () {
                        return _lastSessionXHR;
                    },
                    enumerable: true
                });

            Object.defineProperty(this, 'connected',
                {
                    get: function () {
                        return restApplicationIsOnline && deviceIsOnline;
                    },
                    enumerable: true
                });

            Object.defineProperty(this, 'JSDOs',
                {
                    get: function () {
                        return _jsdos;
                    },
                    enumerable: true
                });

            var _pingInterval = 0;
            var _timeoutID = null;
            Object.defineProperty(this, 'pingInterval',
                {
                    get: function () {
                        return _pingInterval;
                    },
                    set: function (newval) {
                        if (newval >= 0) {
                            _pingInterval = newval;
                            if (newval > 0) {
                                _timeoutID = setTimeout(this._autoping, newval);
                            }
                            else if (newval === 0) {
                                clearTimeout(_timeoutID);
                                _pingInterval = 0;
                            }
                            else {
                                throw new Error("Error setting Session.pingInterval. '" + 
                                    newval + "' is an invalid value.");
                            }
                        }
                    },
                    enumerable: true
                }
            );

        }
        else {
            this.userName = null;
            this.loginTarget = '/static/home.html';
            this.serviceURI = null;
            this.catalogURIs = [];
            this.services = [];
            this.loginResult = null;
            this.loginHttpStatus = null;
            this.clientContextId = null;
            this.authenticationModel = progress.data.Session.AUTH_TYPE_ANON;
            this.lastSessionXHR = null;
        }

        function setUserName(newname, sessionObject) {
            if (defPropSupported) {
                _userName = newname;
            }
            else {
                sessionObject.userName = newname;
            }
        }

        function setLoginTarget(target, sessionObject) {
            if (defPropSupported) {
                _loginTarget = target;
            }
            else {
                sessionObject.loginTarget = target;
            }
        }

        function setServiceURI(url, sessionObject) {
            if (defPropSupported) {
                _serviceURI = url;
            }
            else {
                sessionObject.serviceURI = url;
            }
        }

        function pushCatalogURIs(url, sessionObject) {
            if (defPropSupported) {
                _catalogURIs.push(url);
            }
            else {
                sessionObject.catalogURIs.push(url);
            }
        }

        function pushService(serviceObject, sessionObject) {
            if (defPropSupported) {
                _services.push(serviceObject);
            }
            else {
                sessionObject.services.push(serviceObject);
            }
        }

        function findService(serviceName) {
            for (var prop in _services) {
                var srv = _services[prop];
                if (srv.name === serviceName) {
                    return srv;
                }
            }
            return null;
        }

        function setLoginResult(result, sessionObject) {
            if (defPropSupported) {
                _loginResult = result;
            }
            else {
                sessionObject.loginResult = result;
            }
        }

        function setLoginHttpStatus(status, sessionObject) {
            if (defPropSupported) {
                _loginHttpStatus = status;
            }
            else {
                sessionObject.loginHttpStatus = status;
            }
        }

        function setClientContextIDfromXHR(xhr, sessionObject) {
            if (xhr) {
                setClientContextID(xhr.getResponseHeader("X-CLIENT-CONTEXT-ID"), sessionObject);
            }
        }

        function setClientContextID(ccid, sessionObject) {
            if (defPropSupported) {
                _clientContextId = ccid;
            }
            else {
                sessionObject.clientContextId = ccid;
            }
        }

        function setLastSessionXHR(xhr, sessionObject) {
            if (defPropSupported) {
                _lastSessionXHR = xhr;
            }
            else {
                sessionObject.lastSessionXHR = xhr;
            }
        }

        // "Methods"

        this._pushJSDOs = function (jsdo) {
            _jsdos.push(jsdo);
        };


        /* _openRequest  (intended for progress.data library use only)
         * calls open() for an xhr -- the assumption is that this is an xhr for a JSDO, and we need to add
         * some session management information for the request, such as user credentials and a session ID if
         * there is one
         */
        this._openRequest = function (xhr, verb, url, async) {

            if (this.loginResult !== progress.data.Session.LOGIN_SUCCESS && this.authenticationModel) {
                throw new Error("Attempted to make server request when there is no active session.");
            }

            // if resource url is not absolute, add the REST app url to the front
            var urlPlusCCID = this._prependAppURL(url);

            // add CCID as JSESSIONID query string to url
            urlPlusCCID = this._addCCIDtoURL(urlPlusCCID);

            // add time stamp to the url
            if (progress.data.Session._useTimeStamp)
                urlPlusCCID = this._addTimeStampToURL(urlPlusCCID);

            this._setXHRCredentials(xhr, verb, urlPlusCCID, this.userName, _password, async);
            if (this.authenticationModel === progress.data.Session.AUTH_TYPE_FORM) {
                _addWithCredentialsAndAccept(xhr, "application/json");
            }

            // add CCID header
            if (this.clientContextId && (this.clientContextId !== "0")) {
                xhr.setRequestHeader("X-CLIENT-CONTEXT-ID", this.clientContextId);
            }
            if (this.xClientProps) {
                xhr.setRequestHeader("X-CLIENT-PROPS", this.xClientProps);
            }

            if (typeof this.onOpenRequest === 'function') {
                var params = {
                    "xhr": xhr,
                    "verb": verb,
                    "uri": urlPlusCCID,
                    "async": async,
                    "formPreTest": false,
                    "session": this
                };
                this.onOpenRequest(params);
                // xhr = params.xhr; //Note that, currently, this would have no effect in the caller.
            }
        };

        /* login
         *
         */

        // callback used in login to determine whether ping is available on server
        this.pingTestCallback = function (cbArgs) {
            if (cbArgs.pingResult) {
                oepingAvailable = true;
            }
            else {
                oepingAvailable = false;
            }
        };

        // generic async callback, currently used by login(), addCatalog(), and logout()
        this._onReadyStateChangeGeneric = function () {
            var xhr = this;
            var result;
            var errorObject;

            if (xhr.readyState == 4) {
                result = null;
                errorObject = null;

                // initial processing of the response from the Web application
                if ((typeof xhr.onResponseFn) == 'function') {
                    try {
                        result = xhr.onResponseFn(xhr);
                        // ( note that result will remain null if this is a logout() )
                    }
                    catch (e) {
                        errorObject = e;
                    }
                }
                // handle the results of the processing (e.g., fire any events required)
                if ((typeof xhr.onResponseProcessedFn) == 'function') {
                    if (!result) {
                        result = progress.data.Session.GENERAL_FAILURE;
                    }
                    xhr.onResponseProcessedFn(xhr.pdsession, result, errorObject, xhr);
                }
            }
        };

        // store password here until successful login; only then do we store it in the Session object
        var pwSave = null;
        // store user name here until successful login; only then do we store it in the Session object
        var unameSave = null;
        this.login = function (serviceURI, loginUserName, loginPassword, loginTarget) {
            var uname,
                pw,
                isAsync = false,
                args = [],
                deferred,
                jsdosession;

            pwSave = null;   // in case these are left over from a previous login
            unameSave = null;

            if (this.loginResult === progress.data.Session.LOGIN_SUCCESS) {
                throw new Error("Attempted to call login() on a Session object that is already logged in.");
            }

            if (!defPropSupported) {
                // this is here on the presumably slim chance that we're running with a
                // version of JavaScript that doesn't support defineProperty (otherwise
                // the lower casing will have already happened). When we decide that it's
                // OK to remove our conditionalization of property definitions, we should
                // get rid of this whole conditional
                this.authenticationModel = this.authenticationModel.toLowerCase();
            }

            if (arguments.length > 0) {
                if (arguments[0] && typeof(arguments[0]) === 'object') {
                    if (arguments[0].serviceURI) {
                        args[0] = arguments[0].serviceURI;
                        args[1] = arguments[0].userName;
                        args[2] = arguments[0].password;
                        args[3] = arguments[0].loginTarget;
                        args[4] = arguments[0].async;
                        
                        /* Special for JSDOSession: if this method was called by a JSDOSession object, 
                            it passes deferred and jsdosession and we need to eventually attach them 
                            to the XHR we use so that the promise created by the JSDOSession will work
                            correctly
                        */ 
                        deferred = arguments[0].deferred;
                        jsdosession = arguments[0].jsdosession;
                    }
                }
                else {
                    args = arguments;
                }
            }

            if (args.length > 0) {
                if (args[0]) {
                    var restURLtemp = args[0];

                    // get rid of trailing '/' because appending service url that starts with '/'
                    // will cause request failures
                    if (restURLtemp[restURLtemp.length - 1] === "/") {
                        restURLtemp = restURLtemp.substring(0, restURLtemp.length - 1);
                    }
                    setServiceURI(restURLtemp, this);
                }
                else {
                    setLoginResult(progress.data.Session.LOGIN_GENERAL_FAILURE, this);
                    throw new Error("Session.login() is missing the serviceURI argument.");
                }

                if (args[1]) {
                    uname = args[1];
                }

                if (args[2]) {
                    pw = args[2];
                }

                if (args[3]) {
                    setLoginTarget(args[3], this);
                }

                if (args[4]) {
                    if (typeof(args[4]) === 'boolean') {
                        isAsync = args[4];
                    }
                    else {
                        throw new Error("Session.login() was passed an async setting that is not a boolean.");
                    }
                }
            }
            else {
                setLoginResult(progress.data.Session.LOGIN_GENERAL_FAILURE, this);
                throw new Error("Session.login() is missing the serviceURI argument.");
            }

            // use these temp cred variables later; if login succeeds, we'll use them to set the
            // real credentials
            unameSave = uname;
            pwSave = pw;

            if (this.authenticationModel === progress.data.Session.AUTH_TYPE_ANON ||
                this.authenticationModel === progress.data.Session.AUTH_TYPE_FORM) {
                /* anonymous should NOT have a username and password passed (this is
                 probably unnecessary because the XHR seems to send the request without
                 credentials first, then intercept the 401 if there is one and try again,
                 this time with credentials. Just making sure.
                 */
                /* For form authentication, we may as well not send the user name and password
                 * on this request, since we are just trying to test whether the authentication
                 *  has already happened and they are therefore irrelevant
                 */
                uname = null;
                pw = null;
            }

            var xhr = new XMLHttpRequest();
            xhr.pdsession = this;

            try {
                this._setXHRCredentials(xhr, 'GET', this.serviceURI + this.loginTarget,
                    uname, pw, isAsync);

                xhr.setRequestHeader("Cache-Control", "no-cache");
                xhr.setRequestHeader("Pragma", "no-cache");
                if (this.xClientProps) {
                    xhr.setRequestHeader("X-CLIENT-PROPS", this.xClientProps);
                }
                if (this.authenticationModel === progress.data.Session.AUTH_TYPE_FORM) {
                    _addWithCredentialsAndAccept(xhr, 
                        "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
                }

                xhr._isAsync = isAsync;
                if (isAsync) {
                    xhr.onreadystatechange = this._onReadyStateChangeGeneric;
                    if (this.authenticationModel === progress.data.Session.AUTH_TYPE_FORM) {
                        xhr.onResponseFn = this._afterFormPretestLogin;
                    }
                    else {
                        xhr.onResponseFn = this._processLoginResult;
                        xhr.onResponseProcessedFn = this._loginComplete;
                    }
                    xhr._jsdosession = jsdosession;  // in case the caller is a JSDOSession
                    xhr._deferred = deferred;  // in case the caller is a JSDOSession
                }

                if (typeof this.onOpenRequest === 'function') {
                    var isFormPreTest = false;
                    if (this.authenticationModel === progress.data.Session.AUTH_TYPE_FORM) {
                        isFormPreTest = true;
                    }

                    //  set this here in case onOpenRequest checks it
                    setLastSessionXHR(xhr, this);
                    var params = {
                        "xhr": xhr,
                        "verb": "GET",
                        "uri": this.serviceURI + this.loginTarget,
                        "async": false,
                        "formPreTest": isFormPreTest,
                        "session": this
                    };
                    this.onOpenRequest(params);
                    xhr = params.xhr; // just in case it has been changed
                }
                setLastSessionXHR(xhr, this);
                xhr.send(null);
            }
            catch (e) {
                setLoginHttpStatus(xhr.status, this);
                setLoginResult(progress.data.Session.LOGIN_GENERAL_FAILURE, this);
                unameSave = null;
                pwSave = null;
                throw e;
            }

            if (isAsync) {
                return progress.data.Session.ASYNC_PENDING;
            }
            else {
                setLoginHttpStatus(xhr.status, this);
                if (this.authenticationModel === progress.data.Session.AUTH_TYPE_FORM) {
                    return (this._afterFormPretestLogin(xhr) );
                }
                else {
                    return (this._processLoginResult(xhr) );
                }
            }
        };


        this._afterFormPretestLogin = function (xhr) {
            var pdsession = xhr.pdsession;
            setLoginHttpStatus(xhr.status, xhr.pdsession);

            var formLoginParams = {
                "xhr": xhr,
                "pw": pwSave,
                "uname": unameSave,
                "theSession": pdsession
            };
            try {
                return doFormLogin(formLoginParams);
            }
            catch (e) {
                pwSave = null;
                unameSave = null;
                throw e;
            }
        };

        /* doFormLogin
         * This function handles logging in to a service that uses form-based authentication. It's separate
         * from the main login function because it's long. One of the things it does is examine the
         * response from an initial attempt to get the login target without credentials (done in the main
         * login() function) to determine whether the user has already been authenticated. Although a
         * current OE Mobile Web application (as of 5/30/2013) will return an error if authentication
         * failed on a form login, previous versions and non-OE servers return a
         * redirect to a login page and the user agent (browser or native wrapper)
         * usually then fetches the redirect location and returns it along with a
         * 200 Success status, when in fcat it was an authentication failure. Hence
         * the need to analyze the response to try to figure out what we get back.
         *
         */
        function doFormLogin(args) {
            var xhr = args.xhr;
            var theSession = args.theSession;
            var oldXHR;

            // check whether we got the OE REST Form based error response
            var contentType = null;
            var needAuth = false;
            var params = {
                "session": theSession,
                "xhr": xhr,
                "statusFromjson": null
            };

            contentType = xhr.getResponseHeader("Content-Type");

            if (contentType && contentType.indexOf("application/json") >= 0) {
                handleJSONLoginResponse(params);
                if (!params.statusFromjson || params.statusFromjson === 401) {
                    needAuth = true;
                }
                else {
                    // either the response shows that we're already authenticated, or
                    // there's some error other than an authentication error
                    setLoginHttpStatus(params.statusFromjson, theSession);
                }
            }
            else {
                // need to do only 200 for async to work with MWA down
                if (theSession.loginHttpStatus == 200) {  
                    if (_gotLoginForm(xhr)) {
                        needAuth = true;
                    }
                    // else we are assuming we truly retrieved the login target and
                    // therefore we were previously authenticated
                }
                // else had an error, just return it
            }

            if (needAuth) {
                // create new XHR, because if this is an async call we don't want to
                // confuse things by using this xhr to send another request while we're
                // still processing its old request (this function, doFormLogin(), may
                // have been called from onReadyStateChangeGeneric and it's conceivable
                // that that function has more code to execute involving this xhr)
                oldXHR = xhr;
                xhr = new XMLHttpRequest();
                args.xhr = xhr;
                params.xhr = xhr;

                // need to transfer any properties that the Sessioon code stored in the
                // the xhr that need to persist across the 2 requests made by a our
                // login implementation for Form auth
                xhr.pdsession = oldXHR.pdsession;
                xhr._isAsync = oldXHR._isAsync;
                xhr._deferred = oldXHR._deferred;  // special for JSDOSession 
                xhr._jsdosession = oldXHR._jsdosession;  // special for JSDOSession 

                xhr.open('POST', theSession.serviceURI + "/static/auth/j_spring_security_check",xhr._isAsync);
                xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                xhr.setRequestHeader("Cache-Control", "max-age=0");
                if (theSession.xClientProps) {
                    xhr.setRequestHeader("X-CLIENT-PROPS", theSession.xClientProps);
                }

                _addWithCredentialsAndAccept(xhr, "application/json");

                try {

                    // Note: this gives a developer a way to change certain aspects of how we do the 
                    // form-based login, but we will still be assuming that we are going directly to
                    // j_spring_security_check and including credentials in the body. They really should not
                    // try to change that.
                    //
                    if (typeof theSession.onOpenRequest === 'function') {
                        var cbparams = {
                            "xhr": xhr,
                            "verb": "POST",
                            "uri": theSession.serviceURI + "/static/auth/j_spring_security_check",
                            "async": xhr._isAsync,
                            "formPreTest": false,
                            "session": theSession
                        };
                        theSession.onOpenRequest(cbparams);
                        xhr = cbparams.xhr;
                    }

                    if (xhr._isAsync) {
                        xhr.onreadystatechange = theSession._onReadyStateChangeGeneric;
                        xhr.onResponseFn = theSession._afterFormLogin;
                        xhr.onResponseProcessedFn = theSession._loginComplete;
                    }

                    // j_username=username&j_password=password&submit=Submit
                    xhr.send("j_username=" + args.uname + "&j_password=" + args.pw + "&submit=Submit");
                }
                catch (e) {
                    setLoginResult(progress.data.Session.LOGIN_GENERAL_FAILURE, theSession);
                    setLoginHttpStatus(xhr.status, theSession);
                    // null the temporary credentials variables
                    unameSave = null;
                    pwSave = null;
                    throw e;
                }

            }

            if (xhr._isAsync && !needAuth) {
                xhr.onResponseProcessedFn = theSession._loginComplete;
                return theSession._afterFormLogin(xhr);
            }
            if (!xhr._isAsync) {
                return theSession._afterFormLogin(xhr);
            }

        }

        this._afterFormLogin = function (xhr) {
            // check what we got
            var theSession = xhr.pdsession;
            var params = {
                "session": theSession,
                "xhr": xhr,
                "statusFromjson": null
            };
            var contentType = xhr.getResponseHeader("Content-Type");

            if (contentType && contentType.indexOf("application/json") >= 0) {
                handleJSONLoginResponse(params);
                if (!params.statusFromjson) {
                    throw new Error(
                        "Internal OpenEdge Mobile client error handling login response. HTTP status: " + 
                        xhr.status + ".");
                }
                else {
                    setLoginHttpStatus(params.statusFromjson, theSession);
                }
            }
            else {
                if (xhr.status == 200 || xhr.status === 0) {
                    // Was the response actually the login failure page or the login page itself (in case
                    // the appSecurity config file sets the login failure url so the server sends the login
                    // page again)? If so, call it an error because the credentials apparently failed to be
                    // authenticated
                    if (_gotLoginFailure(xhr) || _gotLoginForm(xhr)) {
                        setLoginHttpStatus(401, theSession);
                    }
                    else {
                        setLoginHttpStatus(xhr.status, theSession);
                    }
                }
            }

            return theSession._processLoginResult(xhr);
        };


        this._processLoginResult = function (xhr) {
            /* OK, one way or another, by hook or by crook, the Session object's loginHttpStatus
             * has been set to the value that indicates the real outcome of the
             * login, after adjusting for form-based authentication and anything
             * else. At this point, it should be just a matter of examining
             * this.loginHttpStatus, using it to set this.loginResult, maybe doing
             * some other work appropriate to the outcome of the login, and returning
             * this.loginResult.
             */
            var pdsession = xhr.pdsession;
            setLoginHttpStatus(xhr.status, xhr.pdsession);

            if (pdsession.loginHttpStatus == 200) {
                setLoginResult(progress.data.Session.LOGIN_SUCCESS, pdsession);
                restApplicationIsOnline = true;
                setUserName(unameSave, pdsession);
                _password = pwSave;
                pdsession._saveClientContextId(xhr);

                var pingTestArgs = {
                    pingURI: null, async: true, onCompleteFn: null,
                    fireEventIfOfflineChange: true, onReadyStateFn: pdsession._pingtestOnReadyStateChange
                };
                pingTestArgs.pingURI = pdsession._makePingURI();
                pdsession._sendPing(pingTestArgs);  // see whether the ping feature is available
            }
            else {
                if (pdsession.loginHttpStatus == 401) {
                    setLoginResult(progress.data.Session.LOGIN_AUTHENTICATION_FAILURE, pdsession);
                }
                else {
                    setLoginResult(progress.data.Session.LOGIN_GENERAL_FAILURE, pdsession);
                }
            }
            setLastSessionXHR(xhr, pdsession);

            // null the temporary credentials variables
            unameSave = null;
            pwSave = null;

            // return loginResult even if it's an async operation -- the async handler
            // (e.g., onReadyStateChangeGeneric) will just ignore
            return pdsession.loginResult;
        };


        this._loginComplete = function (pdsession, result, errObj, xhr) {
            pdsession.trigger("afterLogin", pdsession, result, errObj, xhr);
        };


        /* logout
         *
         */
        this.logout = function () {
            var isAsync = false,
                errorObject = null,
                xhr,
                deferred,
                jsdosession;

            if (this.loginResult !== progress.data.Session.LOGIN_SUCCESS && this.authenticationModel) {
                throw new Error("Attempted to call logout when there is no active session.");
            }

            if (arguments.length > 0) {
                if (typeof(arguments[0]) === 'object') {
                    isAsync = arguments[0].async;
                    if (isAsync && (typeof isAsync != 'boolean')) {
                        throw new Error( progress.data._getMsgText("jsdoMSG033", 
                                                                   "Session", 
                                                                   'logout', 
                                                                   'The async argument was invalid.'));
                    }
                    /* Special for JSDOSession: if this method was called by a JSDOSession object, it passes
                        deferred and jsdosession and we need to eventually attach them to the XHR we use 
                        so that the promise created by the JSDOSession will work correctly
                    */ 
                    deferred = arguments[0].deferred;
                    jsdosession = arguments[0].jsdosession;                    
                }
            }

            xhr = new XMLHttpRequest();
            xhr.pdsession = this;
            try {
                /* logout when auth model is anonymous is a no-op on the server side 
                   (but we need to set _jsdosession and _deferred anyway to amke promise work
                    if logout was called by a JSDOSession) */
                xhr._jsdosession = jsdosession;  // in case the caller is a JSDOSession
                xhr._deferred = deferred;  // in case the caller is a JSDOSession
                if (this.authenticationModel === progress.data.Session.AUTH_TYPE_FORM ||
                    this.authenticationModel === progress.data.Session.AUTH_TYPE_BASIC) {
                    if (isAsync) {
                        xhr.onreadystatechange = this._onReadyStateChangeGeneric;
                        xhr.onResponseFn = this._processLogoutResult;
                        xhr.onResponseProcessedFn = this._logoutComplete;
                    }
                    xhr.open('GET', this.serviceURI + "/static/auth/j_spring_security_logout", isAsync);

                    /* instead of calling _addWithCredentialsAndAccept, we code the withCredentials
                     * and setRequiestHeader inline so we can do it slightly differently. That
                     * function deliberately sets the request header inside the try so we don't
                     * run into a FireFox oddity that would give us a successful login and then
                     * a failure on getCatalog (see the comment on that function). On logout,
                     * however, we don't care -- just send the Accept header so we can get a 200
                     * response
                     */
                    try {
                        xhr.withCredentials = true;
                    }
                    catch (e) {
                    }

                    xhr.setRequestHeader("Accept", "application/json");
                    if (this.xClientProps) {
                        xhr.setRequestHeader("X-CLIENT-PROPS", this.xClientProps);
                    }

                    if (typeof this.onOpenRequest === 'function') {
                        setLastSessionXHR(xhr, this);
                        var params = {
                            "xhr": xhr,
                            "verb": "GET",
                            "uri": this.serviceURI + "/static/auth/j_spring_security_logout",
                            "async": false,
                            "formPreTest": false,
                            "session": this
                        };
                        this.onOpenRequest(params);
                        xhr = params.xhr;
                    }

                    setLastSessionXHR(xhr, this);
                    xhr.send();
                }
                else {
                    xhr._anonymousLogoutOK = true;
                }
            }
            catch (e) {
                this._reinitializeAfterLogout(this, false);
                throw e;
            }

            if (!isAsync) {
                try {
                    this._processLogoutResult(xhr);
                }
                catch (e) {
                    throw e;
                }
            }

            if (isAsync && this.authenticationModel === progress.data.Session.AUTH_TYPE_ANON) {
                // fake async for Anonymous -- fire afterLogout event
                try {
                    this._processLogoutResult(xhr);
                }
                catch (e) {
                    errorObject = e;
                }
                this._logoutComplete(this, null, errorObject, xhr);
            }

        };

        this._logoutComplete = function (pdsession, result, errorObject, xhr) {
            // ignore result, it doesn't apply to logout -- is probably null or GENERAL_FAILURE
            // we include it so onReadyStateChangeGeneric calls this correctly
            pdsession.trigger("afterLogout", pdsession, errorObject, xhr);
        };

        this._processLogoutResult = function (xhr) {
            var logoutSucceeded;
            var pdsession = xhr.pdsession;
            var basicStatusOK = false;

            if (xhr._anonymousLogoutOK) {
                logoutSucceeded = true;
            }
            else if ((xhr.status != 200) && (xhr.status !== 0)) {
                /* Determine whether an error returned from the server is really an error
                 * Errors on logout from any auth model will go through here, but
                 * only Basic requires checking.
                 */
                if (pdsession.authenticationModel === progress.data.Session.AUTH_TYPE_BASIC) {
                    /* If the Auth model is Basic, we probably got back a 404 Not found.
                     * But that's OK, because logout from Basic is meaningless on the
                     * server side unless it happens to be stateful, which is the only
                     * reason we even try calling j_spring_security_logout
                     */
                    if (xhr.status === 404) {
                        logoutSucceeded = true;
                    }
                    else {
                        logoutSucceeded = false;
                        throw new Error("Error logging out, HTTP status = " + xhr.status);
                    }
                }
            }
            else {
                logoutSucceeded = true;
            }

            pdsession._reinitializeAfterLogout(pdsession, logoutSucceeded);
        };

        this._reinitializeAfterLogout = function (pdsession, success) {
            setLoginResult(null, pdsession);
            setLoginHttpStatus(null, pdsession);
            setClientContextID(null, pdsession);
            setUserName(null, pdsession);
            _password = null;
            if (success) {
                oepingAvailable = false;
                partialPingURI = defaultPartialPingURI;
                setLastSessionXHR(null, pdsession);
            }
        };


        /* addCatalog
         *
         */
        this.addCatalog = function () {
            var catalogURI,
                catalogUserName,
                catalogPassword,
                isAsync = false,
                xhr,
                deferred,
                jsdosession;

            if (this.loginResult !== progress.data.Session.LOGIN_SUCCESS && this.authenticationModel) {
                throw new Error("Attempted to call addCatalog when there is no active session.");
            }

            // check whether the args were passed in a single object. If so, copy them
            // to the named arguments and a variable
            if (arguments.length > 0) {
                if (typeof(arguments[0]) === 'object') {
                    catalogURI = arguments[0].catalogURI;
                    if (!catalogURI || (typeof catalogURI != 'string')) {
                        throw new Error(progress.data._getMsgText("jsdoMSG033", 'Session', 'addCatalog', 
                                                    'The catalogURI argument was missing or invalid.'));
                    }
                    catalogUserName = arguments[0].userName;
                    if (catalogUserName && (typeof catalogUserName != 'string')) {
                        throw new Error(progress.data._getMsgText("jsdoMSG033", 'Session', 'addCatalog', 
                            'The catalogUserName argument was invalid.'));
                    }
                    catalogPassword = arguments[0].password;
                    if (catalogPassword && (typeof catalogPassword != 'string')) {
                        throw new Error(progress.data._getMsgText("jsdoMSG033", 'Session', 'addCatalog', 
                            'The catalogPassword argument was invalid.'));
                    }
                    isAsync = arguments[0].async;
                    if (isAsync && (typeof isAsync != 'boolean')) {
                        throw new Error(progress.data._getMsgText("jsdoMSG033", 'Session', 'addCatalog', 
                            'The async argument was invalid.'));
                    }
                    /* Special for JSDOSession: if this method was called by a JSDOSession object, it passes
                        deferred and jsdosession and we need to eventually attach them to the XHR we use so
                        that the promise created by the JSDOSession will work correctly
                    */ 
                    deferred = arguments[0].deferred;
                    jsdosession = arguments[0].jsdosession;
                }
                else {
                    catalogURI = arguments[0];
                    if (typeof catalogURI != 'string') {
                      throw new Error("First argument to Session.addCatalog must be the URL of the catalog.");
                    }
                    catalogUserName = arguments[1];
                    if (catalogUserName && (typeof catalogUserName != 'string')) {
                      throw new Error("Second argument to Session.addCatalog must be a user name string.");
                    }
                    catalogPassword = arguments[2];
                    if (catalogPassword && (typeof catalogPassword != 'string')) {
                      throw new Error("Third argument to Session.addCatalog must be a password string.");
                    }
                }
            }
            else {
                throw new Error("Session.addCatalog is missing its first argument, the URL of the catalog.");
            }

            if (!catalogUserName) {
                catalogUserName = this.userName;
            }

            if (!catalogPassword) {
                catalogPassword = _password;
            }

            xhr = new XMLHttpRequest();
            xhr.pdsession = this;
            xhr._catalogURI = catalogURI;

            // for now we don't support multiple version of the catalog across sessions
            if (progress.data.ServicesManager.getSession(catalogURI) !== undefined) {
                if (isAsync) {
                    /*
                        Attempt to get the event to fire AFTER this call returns ASYNC_PENDING
                        (and if the method was called from a JSDOSession, create an xhr to communicate 
                         information related to promises back to its afterAddCatalog handler). Note that 
                         the xhr is never used to make a request, it just carries data in the way 
                         expected by the handler)
                     */
                    xhr._jsdosession = jsdosession;  // in case the caller is a JSDOSession
                    xhr._deferred = deferred;  // in case the caller is a JSDOSession
                    setTimeout(this._addCatalogComplete, 10, this, 
                        progress.data.Session.CATALOG_ALREADY_LOADED, null, xhr );
                    return progress.data.Session.ASYNC_PENDING;
                }
                return progress.data.Session.CATALOG_ALREADY_LOADED;
            }

            this._setXHRCredentials(xhr, 'GET', catalogURI,
                catalogUserName, catalogPassword, isAsync);
            // Note that we are not adding the CCID to the URL or as a header, because the catalog may not
            // be stored with the REST app and even if it is, the AppServer ID shouldn't be relevant

            /* This is here as much for CORS situations as the possibility that there might be an out of date
             * cached version of the catalog. The CORS problem happens if you have accessed the catalog
             * locally and then run an app on a different server that requests the catalog. 
             * Your browser already has the catalog,
             * but the request used to get it was a non-CORS request and the browser will
             * raise an error
             */
            xhr.setRequestHeader("Cache-Control", "no-cache");
            xhr.setRequestHeader("Pragma", "no-cache");
            if (this.xClientProps) {
                xhr.setRequestHeader("X-CLIENT-PROPS", this.xClientProps);
            }
            if (this.authenticationModel === progress.data.Session.AUTH_TYPE_FORM) {
                _addWithCredentialsAndAccept(xhr, "application/json");
            }

            if (isAsync) {
                xhr.onreadystatechange = this._onReadyStateChangeGeneric;
                xhr.onResponseFn = this._processAddCatalogResult;
                xhr.onResponseProcessedFn = this._addCatalogComplete;
                xhr._jsdosession = jsdosession;  // in case the caller is a JSDOSession
                xhr._deferred = deferred;  // in case the caller is a JSDOSession
            }

            try {
                if (typeof this.onOpenRequest === 'function') {
                    setLastSessionXHR(xhr, this);
                    var params = {
                        "xhr": xhr,
                        "verb": "GET",
                        "uri": catalogURI,
                        "async": false,
                        "formPreTest": false,
                        "session": this
                    };
                    this.onOpenRequest(params);
                    xhr = params.xhr;
                }

                setLastSessionXHR(xhr, this);
                xhr.send(null);
            }
            catch (e) {
                throw new Error("Error retrieving catalog '" + catalogURI + "'.\n" + e.message);
            }
            if (isAsync) {
                return progress.data.Session.ASYNC_PENDING;
            }
            else {
                return this._processAddCatalogResult(xhr);
            }
        };

        this._processAddCatalogResult = function (xhr) {
            var _catalogHttpStatus = xhr.status;
            var theSession = xhr.pdsession;
            var servicedata;
            var catalogURI = xhr._catalogURI;

            setLastSessionXHR(xhr, theSession);
            if ((_catalogHttpStatus == 200) || (_catalogHttpStatus === 0)) {
                servicedata = theSession._parseCatalog(xhr);
                var serviceURL;
                try {
                    progress.data.ServicesManager.addCatalog(servicedata, theSession);
                }
                catch (e) {
                    throw new Error("Error processing catalog '" + catalogURI + "'. \n" + e.message);
                }
                // create a mobile service object and add it to the Session's array of same
                for (var i = 0; i < servicedata.length; i++) {
                    serviceURL = theSession._prependAppURL(servicedata[i].address);
                    pushService(new progress.data.MobileServiceObject(
                            {
                                name: servicedata[i].name,
                                uri: serviceURL
                            }),
                        theSession);

                    if (servicedata[i].settings
                        && servicedata[i].settings.useXClientProps
                        && !theSession.xClientProps) {
                        console.warn("Catalog warning: Service settings property 'useXClientProps' " +
                            "is true but 'xClientProps' property has not been set.");
                    }
                }
                pushCatalogURIs(catalogURI, theSession);
                progress.data.ServicesManager.addSession(catalogURI, theSession);
            }
            else if (_catalogHttpStatus == 401) {
                return progress.data.Session.AUTHENTICATION_FAILURE;
            }
            else {
                throw new Error("Error retrieving catalog '" + catalogURI + 
                    "'. Http status: " + _catalogHttpStatus + ".");
            }

            return progress.data.Session.SUCCESS;
        };

        this._addCatalogComplete = function (pdsession, result, errObj, xhr) {
            pdsession.trigger("afterAddCatalog", pdsession, result, errObj, xhr);
        };


        /*
         *  ping -- determine whether the Mobile Web Application that the Session object represents
         *  is available, which includes determining whether its associated AppServer is running
         *  Also determine whether the Mobile services managed by this Session object are available
         *  (which means simply that they're known to the Mobile Web Application)
         *  (Implementation note: be sure that this Session object's "connected"
         *  property retains its current value until the end of this function, where
         *  it gets updated, if necessary, after calling _isOnlineStateChange
         *
         *  Signatures :
         *  @param arg
         *  There are 2 signatures --
         *   -  no argument -- do an async ping of the Session's Mobile Web application. The only effect
         *                     of the ping will be firing an offline or an online event, if appropriate
         *                     The ping function itself will return false to the caller
         *   -  object argument -- the object's properties provide the input args. They are all
         *          optional (if for some reason the caller passes an object that has no properties, it's
         *          the same as passing no argument at all). The properties may be:
         *            async -- tells whether to execute the ping asynchronously (which is the default)
         *            onCompleteFn -- if async, this will be called when response returns
         *            doNotFireEvent -- used internally, controls whether the ping method causes an offline
         *                 or online event to be fired if there has been a change (the default is that it
         *                 does, but our Session._checkServiceResponse() sets this to true so that it can
         *                 control the firing of the event)
         *            offlineReason -- if present, and if the ping code discovers that teh server is offline,
         *                 the ping code will set this with its best guess 
         *                 as to the reason the server is offline
         */
        this.ping = function (args) {
            var pingResult = false;
            var pingArgs = {
                pingURI: null, async: true, onCompleteFn: null,
                fireEventIfOfflineChange: true, onReadyStateFn: this._onReadyStateChangePing,
                offlineReason: null
            };

            if (args) {
                if (args.async !== undefined) {
                    // when we do background pinging (because pingInterval is set),
                    // we pass in an arg that is just an object that has an async property,
                    // set to true. This can be expanded to enable other kinds of ping calls
                    // to be done async (so that application developers can do so, if we decide
                    // to support that)
                    pingArgs.async = args.async;
                }

                if (args.doNotFireEvent !== undefined) {
                    pingArgs.fireEventIfOfflineChange = !args.doNotFireEvent;
                }

                if (args.onCompleteFn && (typeof args.onCompleteFn) == 'function') {
                    pingArgs.onCompleteFn = args.onCompleteFn;
                }
                /* Special for JSDOSession: if this method was called by a JSDOSession object, it passes
                    deferred and jsdosession and we need to eventually attach them to the XHR we use so that
                    the promise created by the JSDOSession will work correctly
                */ 
                pingArgs.deferred = args.deferred;
                pingArgs.jsdosession = args.jsdosession;

            }


            /* Ping the Mobile Web Application (this will also determine whether AppServer is available)
             * Call _processPingResult() if we're synchronous, otherwise the handler for the xhr.send()
             * will call it
             */
            pingArgs.pingURI = myself._makePingURI();
            myself._sendPing(pingArgs);
            if (!pingArgs.async) {
                if (pingArgs.xhr) {
                    pingResult = myself._processPingResult(pingArgs);
                    if (args.offlineReason !== undefined) {
                        args.offlineReason = pingArgs.offlineReason;
                    }
                }
                else {
                    pingResult = false; // no xhr returned from _sendPing, something must have gone wrong
                }
            }
            // else it's async, deliberately returning false 
            // so developer not misled into thinking the ping succeeded

            return pingResult;
        };


        // "protected" Functions

        /*
         * given a value of true or false for being online for the Mobile Web Application
         * managed by this Session object, determine whether that changes the current
         * state of being offline or online.
         * Returns true if the input state is a change from the current state
         *
         * Signature :
         * @param isOnline  Required. True to determine whether online is a state change, false to
         *                  determine whether offline constitutes a state change. Boolean.
         *
         */
        this._isOnlineStateChange = function (isOnline) {
            var stateChanged = false;

            if (isOnline && !(this.connected)) {
                stateChanged = true;
            }
            else if (!isOnline && ( this.connected )) {
                stateChanged = true;
            }

            return stateChanged;
        };


        /*
         * given information about the response from a request made to a service,
         * do the following:
         *
         * determine whether the online status of the Session has changed, and
         * set the Session's Connected property accordingly
         * if the Session's online status has changed, fire the appropriate event
         *
         * Signature :
         * @param xhr      Required. The xhr that was used to make the request. Object
         * @param success  Required. True if caller regards the request as having succeeded. Boolean
         * @param request  Required. The JSDO request object created for making the request. Object.
         *
         */
        this._checkServiceResponse = function (xhr, success, request) {
            var offlineReason = null;
            var wasOnline = this.connected;

            /* first of all, if there are no subscriptions to offline or online events, don't
             * bother -- we don't want to run the risk of messing things up by calling ping
             * if the app developer isn't interested (especially because that may mean that
             * ping isn't enabled on the server, anyway)
             */
            if (!this._events) {
                return;
            }
            var offlineObservers = this._events["offline"] || [];
            var onlineObservers = this._events["online"] || [];
            if ((offlineObservers.length === 0) && (onlineObservers.length === 0)) {
                return;
            }

            /* even though this function gets called as a result of trying to
             * contact the server, don't bother to change anything if we already
             * know that the device (or user agent, or client machine) is offline.
             * We can't assume anything about the state of the server if we can't
             * even get to the internet from the client
             */

            // if the call to the server was a success, we will assume we are online,
            // both server and device
            if (success) {
                restApplicationIsOnline = true;
                deviceIsOnline = true;  // presumably this is true (probably was already true)
            }
            else {
                /* Request failed, determine whether it's because server is offline
                 * Do this even if the Session was already in an offline state, because
                 * we need to determine whether the failure was due to still being
                 * offline, or whether it's now possible to communicate with the
                 * server but the problem was something else.
                 */

                if (deviceIsOnline) {
                    /* ping the server to get better information on whether this is an offline case
                     * NB: synchronous ping for simplicity, maybe should consider async so as not
                     * to potentially freeze UI
                     */
                    var localPingArgs = {
                        doNotFireEvent: true,  // do in this fn so we have the request
                        offlineReason: null,
                        async: false
                    };
                    if (!(myself.ping(localPingArgs) )) {
                        offlineReason = localPingArgs.offlineReason;
                        restApplicationIsOnline = false;
                    }
                    else {
                        // ping returned true, so even though the original request failed,
                        // we are online and the failure must have been due to something else
                        restApplicationIsOnline = true;
                    }
                }
                // else deviceIsOnline was already false, so the offline event should already have
                // been fired for that reason and there is no need to do anything else
            }

            if (wasOnline && !this.connected) {
                this.trigger("offline", this, offlineReason, request);
            }
            else if (!wasOnline && this.connected) {
                this.trigger("online", this, request);
            }
        };

        /* Decide whether, on the basis of information returned by a ping request, the
         * Mobile Web Application managed by this Session object is online, where online
         * means that the ping response was a 200 and, IF the body of the response contains
         * JSON with an AppServerStatus property, that AppServerStatus Status property has
         * a pingStatus property set to true
         *     i.e., the body has an AppServerStatus.PingStatus set to true
         * (if the body doesn't contain JSON with an AppServerStatus, we use just the HTTP
         * response status code to decide)
         * Return true if the response meets these conditions, false if it doesn't
         */
        this._processPingResult = function (args) {
            var xhr = args.xhr;
            var pingResponseJSON;
            var appServerStatus = null;
            var wasOnline = this.connected;

            /* first determine whether the Web server and the Mobile Web Application (MWA)
             * are available
             */
            if (xhr.status >= 200 && xhr.status < 300) {
                if (oepingAvailable) {
                    try {
                        pingResponseJSON = JSON.parse(xhr.responseText);
                        appServerStatus = pingResponseJSON.AppServerStatus;
                    }
                    catch (e) {
                        /* We got a successful response from calling our ping URI, but it
                         * didn't return valid JSON. If we think that the oeping REST API
                         * is available on the server (so we should have gotten valid
                         * json), log this to the console.
                         *
                         */
                        console.error("Unable to parse ping response.");
                    }
                }
                restApplicationIsOnline = true;
            }
            else {
                if (deviceIsOnline) {
                    if (xhr.status === 0) {
                        args.offlineReason = progress.data.Session.SERVER_OFFLINE;
                        restApplicationIsOnline = false;
                    }
                    else if ((xhr.status === 404) || (xhr.status === 410)) {
                        /* if we get a 404, it means the Web server is up, but it
                         * can't find the resource we requested (either _oeping or
                         * the login target), therefore the Mobile Web application
                         * must be unavailable (410 is Gone)
                         */
                        args.offlineReason = progress.data.Session.WEB_APPLICATION_OFFLINE;
                        restApplicationIsOnline = false;
                    }
                    else {
                        /* There's some error, but we can't say for sure that it's because
                         * the Web application is unavailable. May be an authentication problem,
                         * internal server error, or for some reason our ping request was
                         * invalid (unlikely to happen if it previously succeeded).
                         * In particular, if the server uses Form authentication, it
                         * may have come back online but now the session id
                         * is no longer valid.
                         */
                        restApplicationIsOnline = true;
                    }
                }
                else {
                    args.offlineReason = progress.data.Session.DEVICE_OFFLINE;
                }
            }

            // is the AppServer online? appServerStatus will be non-null only
            // if the ping request returned 200, meaning the other things are OK
            // (connection to server, Tomcat, Mobile Web application)
            if (appServerStatus) {
                if (appServerStatus.PingStatus === "false") {
                    args.offlineReason = progress.data.Session.APPSERVER_OFFLINE;
                    restApplicationIsOnline = false;
                }
                else {
                    restApplicationIsOnline = true;
                }
            }

            if ((typeof xhr.onCompleteFn) == 'function') {
                xhr.onCompleteFn({
                    pingResult: this.connected,
                    xhr: xhr,
                    offlineReason: args.offlineReason
                });
            }

            // decide whether to fire an event, and if so do it
            if (args.fireEventIfOfflineChange) {
                if (wasOnline && !this.connected) {
                    myself.trigger("offline", myself, args.offlineReason, null);
                }
                else if (!wasOnline && this.connected) {
                    myself.trigger("online", myself, null);
                }
            }

            return this.connected;
        };


        this._onReadyStateChangePing = function () {
            var xhr = this;
            var args;

            if (xhr.readyState == 4) {
                args = {
                    xhr: xhr,
                    fireEventIfOfflineChange: true,
                    offlineReason: null
                };
                myself._processPingResult(args);
                if (_pingInterval > 0) {
                    _timeoutID = setTimeout(myself._autoping, _pingInterval);
                }
            }
        };

        this._pingtestOnReadyStateChange = function () {
            var xhr = this;

            if (xhr.readyState == 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    oepingAvailable = true;
                }
                else {
                    oepingAvailable = false;  // should be false anyway, just being sure
                    partialPingURI = myself.loginTarget;
                    console.warn("Default ping target not available, will use loginTarget instead.");
                }
            }
        };

        /*
         * args: pingURI
         *       async
         *       onCompleteFn     used only if async is true
         *
         *  (deliberately not catching thrown error)
         */
        this._sendPing = function (args) {
            var xhr = new XMLHttpRequest();
            try {
                this._setXHRCredentials(xhr, "GET", args.pingURI, this.userName, _password, args.async);
                if (args.async) {
                    xhr.onreadystatechange = args.onReadyStateFn;
                    xhr.onCompleteFn = args.onCompleteFn;
                    xhr._jsdosession = args.jsdosession;  // in case the caller is a JSDOSession
                    xhr._deferred = args.deferred;  // in case the caller is a JSDOSession
                }
                xhr.setRequestHeader("Cache-Control", "no-cache");
                xhr.setRequestHeader("Pragma", "no-cache");
                if (this.xClientProps) {
                    xhr.setRequestHeader("X-CLIENT-PROPS", this.xClientProps);
                }
                if (this.authenticationModel === progress.data.Session.AUTH_TYPE_FORM) {
                    _addWithCredentialsAndAccept(xhr, 
                        "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
                }
                xhr.send(null);
            }
            catch (e) {
                args.error = e;
            }
            // ASYNC??
            args.xhr = xhr;
        };

        this._makePingURI = function () {
            var pingURI = this.serviceURI + partialPingURI;
            // had caching problem with Firefox in its offline mode
            pingURI = this._addTimeStampToURL(pingURI);  
            return pingURI;
        };


        /*
         *  autoping -- callback
         */
        this._autoping = function () {
            myself.ping({async: true});
        };


        /*   _setXHRCredentials  (intended for progress.data library use only)
         *  set credentials as needed, both via the xhr's open method and setting the
         *  Authorization header directly
         */
        this._setXHRCredentials = function (xhr, verb, uri, userName, password, async) {

            // note that we do not set credentials if userName is null. 
            // Null userName indicates that the developer is depending on the browser to
            // get and manage the credentials, and we need to make sure we don't interfere with that
            if (userName
                && this.authenticationModel === progress.data.Session.AUTH_TYPE_BASIC) {

                xhr.open(verb, uri, async, userName, password);

                // set Authorization header
                var auth = _make_basic_auth(userName, password);
                xhr.setRequestHeader('Authorization', auth);
            }
            else {
                xhr.open(verb, uri, async);
            }
        };

        /*   _addCCIDtoURL  (intended for progress.data library use only)
         *  Add the Client Context ID being used by a session on an OE REST application, if we have
         *  previously stored one from a response from the server
         */
        this._addCCIDtoURL = function (url) {
            if (this.clientContextId && (this.clientContextId !== "0")) {
                // Should we test protocol, 
                // host and port in addition to path to ensure that jsessionid is only sent
                // when request applies to the REST app (it might not be if the catalog is somewhere else)
                if (url.substring(0, this.serviceURI.length) == this.serviceURI) {
                    var jsessionidStr = "JSESSIONID=" + this.clientContextId + ";";
                    var index = url.indexOf('?');
                    if (index == -1) {
                        url += "?" + jsessionidStr;
                    }
                    else {
                        url = url.substring(0, index + 1) + jsessionidStr + url.substring(index + 1);
                    }
                }
            }
            return url;
        };

        var SEQ_MAX_VALUE = 999999999999999;
        /* 15 - 9 */
        var _tsseq = SEQ_MAX_VALUE;
        /* Initialized to SEQ_MAX_VALUE to initialize values. */
        var _tsprefix1 = 0;
        var _tsprefix2 = 0;

        this._getNextTimeStamp = function () {
            var seq = ++_tsseq;
            if (seq >= SEQ_MAX_VALUE) {
                _tsseq = seq = 1;
                var t = Math.floor(( Date.now ? Date.now() : (new Date().getTime())) / 10000);
                if (_tsprefix1 == t) {
                    _tsprefix2++;
                    if (_tsprefix2 >= SEQ_MAX_VALUE) {
                        _tsprefix2 = 1;
                    }
                }
                else {
                    _tsprefix1 = t;
                    Math.random(); // Ignore call to random
                    _tsprefix2 = Math.round(Math.random() * 10000000000);
                }
            }

            return _tsprefix1 + "-" + _tsprefix2 + "-" + seq;
        };

        /*
         * _addTimeStampToURL (intended for progress.data library use only)
         * Add a time stamp to the a URL to prevent caching of the request.
         * Set progress.data.Session._useTimeStamp = false to turn off.
         */
        this._addTimeStampToURL = function (url) {
            var timeStamp = "_ts=" + this._getNextTimeStamp();
            url += ((url.indexOf('?') == -1) ? "?" : "&") + timeStamp;
            return url;
        };

        /*   _saveClientContextId  (intended for progress.data library use only)
         *  If the CCID hasn't been set for the session yet, check the xhr for it and store it.
         *  (If it has been set, assume that the existing one is correct and do nothing. We could
         *   enhance this function by checking to see whether the new one matches the existing one.
         *  Not sure what to do if that's the case -- overwrite the old one? ignore the new one?
         *   Should at least log a warning or error
         */
        this._saveClientContextId = function (xhr) {
            // do this unconditionally (even if there is already a client-context-id), because
            // if basic authentication is set up such that it uses sessions, and cookies are disabled,
            // the server will generate a different session on each request and the X-CLIENT-CONTEXT-ID
            // will therefore be different
            setClientContextIDfromXHR(xhr, this);
        };

        this._parseCatalog = function (xhr) {
            var jsonObject;
            var catalogdata;

            try {
                jsonObject = JSON.parse(xhr.responseText);
                catalogdata = jsonObject.services;
            }
            catch (e) {
                console.error("Unable to parse response. Make sure catalog has correct format.");
                catalogdata = null;
            }

            return catalogdata;
        };

        /* _prependAppURL
         * Prepends the URL of the Web application 
         * (the 1st parameter passed to login, stored in this.serviceURI)
         * to whatever string is passed in. If the string passed in is an absolute URL, this function does
         * nothing except return a copy. This function ensures that the resulting URL has the correct number
         * of slashes between the web app url and the string passed in (currently that means that if what's
         * passed in has no initial slash, the function adds one)
         */
        this._prependAppURL = function (oldURL) {
            if (!oldURL) {
                /* If oldURL is null, just return the app URL. (It's not the responsibility of this
                 * function to decide whether having a null URL is an error. Its only responsibility
                 * is to prepend the App URL to whatever it gets passed 
                 * (and make sure the result is a valid URL)
                 */
                return this.serviceURI;
            }
            var newURL = oldURL;
            var pat = /^https?:\/\//i;
            if (!pat.test(newURL)) {
                if (newURL.indexOf("/") !== 0) {
                    newURL = "/" + newURL;
                }

                newURL = this.serviceURI + newURL;
            }
            return newURL;
        };


        // Functions

        // Set an XMLHttpRequest object's withCredentials attribute and Accept header,
        // using a try-catch so that if setting withCredentials throws an error it doesn't
        // interrupt execution (this is a workaround for the fact that Firefox doesn't
        // allow you to set withCredentials when you're doing a synchronous operation)
        // The setting of the Accept header is included here, and happens after the
        // attempt to set withCredentials, to make the behavior in 11.3.0 match
        // the behavior in 11.2.1 -- for Firefox, in a CORS situation, login() will
        // fail. (If we allowed the Accept header to be set, login() would succeed
        // because of that but addCatalog() would fail because no JSESSIONID would
        // be sent due to withCredentials not being true)
        function _addWithCredentialsAndAccept(xhr, acceptString) {
            try {
                xhr.withCredentials = true;
                xhr.setRequestHeader("Accept", acceptString);
            }
            catch (e) {
            }
        }


        // from http://coderseye.com/2007/how-to-do-http-basic-auth-in-ajax.html
        function _make_basic_auth(user, pw) {
            var tok = user + ':' + pw;
//        var hash = base64_encode(tok);
            var hash = btoa(tok);
            return "Basic " + hash;
        }

        /* The next 2 functions, _gotLoginForm() and _gotLoginFailure(), attempt to determine whether
         * a server response consists of
         * the application's login page or login failure page. Currently (release 11.2), this
         * is the only way we have of determining that a request made to the server that's
         * configured for form-based authentication failed due to authentication (i.e.,
         * authentication hadn't happened before the request and either invalid credentials or
         * no credentials were sent to the server). That's because, due to the fact that the browser
         * or native wrapper typically intercepts the redirect involved in an unauthenticated request
         * to a server that's using using form auth, all we see in the XHR is a success status code
         * plus whatever page we were redirected to.
         * In the future, we expect to enhance the OE REST adapter so that it will return a status code
         * indicating failure for form-based authentication, and we can reimplement these functions so
         * they check for that code rather than do the simplistic string search.
         */

        // Determines whether the content of the xhr is the login page. Assumes
        // use of a convention for testing for login page
        var loginFormIDString = "j_spring_security_check";

        function _gotLoginForm(xhr) {
            // is the response contained in an xhr actually the login page?
            return _findStringInResponseHTML(xhr, loginFormIDString);
        }

        // Determines whether the content of the xhr is the login failure page. Assumes
        // use of a convention for testing for login fail page
        var loginFailureIdentificationString = "login failed";

        function _gotLoginFailure(xhr) {
            return _findStringInResponseHTML(xhr, loginFailureIdentificationString);
        }

        // Does a given xhr contain html and does that html contain a given string?
        function _findStringInResponseHTML(xhr, searchString) {
            if (!xhr.responseText) {
                return false;
            }
            var contentType = xhr.getResponseHeader("Content-Type");

            if ((contentType.indexOf("text/html") >= 0) &&
                (xhr.responseText.indexOf(searchString) >= 0)) {
                return true;
            }

            return false;
        }

        /* sets the statusFromjson property in the params object to indicate
         * the status of a response from an OE Mobile Web application that has
         * to do with authentication (the response to a login request, or a
         * response to a request for a resource where there was an error having
         * to do with authentication */
        function handleJSONLoginResponse(params) {
            // Parse the json in the response to see whether it's the special OE REST service
            // response. If it is, check the result (which should be consistent with the status from
            // the xhr)
            var jsonObject;
            params.statusFromjson = null;
            try {
                jsonObject = JSON.parse(params.xhr.responseText);

                if (jsonObject.status_code !== undefined
                    && jsonObject.status_txt !== undefined) {
                    params.statusFromjson = jsonObject.status_code;
                }
            }
            catch (e) {
                // invalid json
                setLoginResult(progress.data.Session.LOGIN_GENERAL_FAILURE, params.session);
                setLoginHttpStatus(xhr.status, params.session);
                throw new Error("Unable to parse login response from server.");
            }

        }


    }; // End of Session
    progress.data.Session._useTimeStamp = true;

// Constants for progress.data.Session
    if ((typeof Object.defineProperty) == 'function') {
        Object.defineProperty(progress.data.Session, 'LOGIN_SUCCESS', {
            value: 1, enumerable: true
        });
        Object.defineProperty(progress.data.Session, 'LOGIN_AUTHENTICATION_FAILURE', {
            value: 2, enumerable: true
        });
        Object.defineProperty(progress.data.Session, 'LOGIN_GENERAL_FAILURE', {
            value: 3, enumerable: true
        });
        Object.defineProperty(progress.data.Session, 'CATALOG_ALREADY_LOADED', {
            value: 4, enumerable: true
        });
        Object.defineProperty(progress.data.Session, 'ASYNC_PENDING', {
            value: 5, enumerable: true
        });

        Object.defineProperty(progress.data.Session, 'SUCCESS', {
            value: 1, enumerable: true
        });
        Object.defineProperty(progress.data.Session, 'AUTHENTICATION_FAILURE', {
            value: 2, enumerable: true
        });
        Object.defineProperty(progress.data.Session, 'GENERAL_FAILURE', {
            value: 3, enumerable: true
        });

        Object.defineProperty(progress.data.Session, 'AUTH_TYPE_ANON', {
            value: "anonymous", enumerable: true
        });
        Object.defineProperty(progress.data.Session, 'AUTH_TYPE_BASIC', {
            value: "basic", enumerable: true
        });
        Object.defineProperty(progress.data.Session, 'AUTH_TYPE_FORM', {
            value: "form", enumerable: true
        });

        Object.defineProperty(progress.data.Session, 'DEVICE_OFFLINE', {
            value: "Device is offline", enumerable: true
        });
        Object.defineProperty(progress.data.Session, 'SERVER_OFFLINE', {
            value: "Cannot contact server", enumerable: true
        });
        Object.defineProperty(progress.data.Session, 'WEB_APPLICATION_OFFLINE', {
            value: "Mobile Web Application is not available", enumerable: true
        });
        Object.defineProperty(progress.data.Session, 'SERVICE_OFFLINE', {
            value: "REST web Service is not available", enumerable: true
        });
        Object.defineProperty(progress.data.Session, 'APPSERVER_OFFLINE', {
            value: "AppServer is not available", enumerable: true
        });
    }
    else {
        progress.data.Session.LOGIN_SUCCESS = 1;
        progress.data.Session.LOGIN_AUTHENTICATION_FAILURE = 2;
        progress.data.Session.LOGIN_GENERAL_FAILURE = 3;
        progress.data.Session.CATALOG_ALREADY_LOADED = 4;

        progress.data.Session.SUCCESS = 1;
        progress.data.Session.AUTHENTICATION_FAILURE = 2;
        progress.data.Session.GENERAL_FAILURE = 3;

        progress.data.Session.AUTH_TYPE_ANON = "anonymous";
        progress.data.Session.AUTH_TYPE_BASIC = "basic";
        progress.data.Session.AUTH_TYPE_FORM = "form";

        /* deliberately not including the "offline reasons" that are defined in the
         * 1st part of the conditional. We believe that we can be used only in environments where
         * ECMAScript 5 is supported, so let's put that assumption to the test
         */
    }

//setup inheritance for Session -- specifically for incorporating an Observable object 
    progress.data.Session.prototype = new progress.util.Observable();
    progress.data.Session.prototype.constructor = progress.data.Session;
    function validateSessionSubscribe(args, evt, listenerData) {
        listenerData.operation = undefined;
        var found = false;

        // make sure this event is one that we support
        for (var i = 0; i < this._eventNames.length; i++) {
            if (evt === this._eventNames[i].toLowerCase()) {
                found = true;
                break;
            }
        }
        if (!found) {
            throw new Error(progress.data._getMsgText("jsdoMSG042", evt));
        }

        if (args.length < 2) {
            throw new Error(progress.data._getMsgText("jsdoMSG038", 2));
        }

        if (typeof args[0] !== 'string') {
            throw new Error(progress.data._getMsgText("jsdoMSG039"));
        }

        if (typeof args[1] !== 'function') {
            throw new Error(progress.data._getMsgText("jsdoMSG040"));
        }
        else {
            listenerData.fn = args[1];
        }

        if (args.length > 2) {
            if (typeof args[2] !== 'object') {
                throw new Error(progress.data._getMsgText("jsdoMSG041", evt));
            }
            else {
                listenerData.scope = args[2];
            }
        }
    }
    // events supported by Session
    progress.data.Session.prototype._eventNames = 
        ["offline", "online", "afterLogin", "afterAddCatalog", "afterLogout"];  
    // callback to validate subscribe and unsubscribe
    progress.data.Session.prototype.validateSubscribe = validateSessionSubscribe;
    progress.data.Session.prototype.toString = function (radix) {
        return "progress.data.Session";
    };
    
    
    /*
        progress.data.JSDOSession
            Like progress.data.Session, but the methods are async-only and return promises.
            (first implementation uses progress.data.Session to do the work, but conceivably
            that implementation could be changed to something different)
            The JSDOSession object keeps the same underlying pdsession object for the lifetime
            of the JSDOSession object -- i.e., even after logout and subsequent login, the pdsession
            is re-used rather than re-created.
    */
    progress.data.JSDOSession = function JSDOSession( options ){
        var _pdsession,
            _serviceURI,
            _myself = this;

        // PROPERTIES
        // Approach: Use the properties of the underlying progress.data.Session object whenever
        // possible. One exception is serviceURI, since it is set in the JSDOSession constructor
        // but can only be set in the Session at login, so JSDOSession must use its own unless
        // the pdsession is logged in
        Object.defineProperty(this, 'authenticationModel',
            {
                get: function () {
                    return _pdsession ? _pdsession.authenticationModel : undefined;
                },
                enumerable: true
            });        
        
        Object.defineProperty(this, 'catalogURIs',
            {
                get: function () {
                    return _pdsession ? _pdsession.catalogURIs: undefined;
                },
                enumerable: true
            });        
        
        Object.defineProperty(this, 'clientContextId',
            {
                get: function () {
                    return _pdsession ? _pdsession.clientContextId: undefined;
                },
                enumerable: true
            });        
        
        Object.defineProperty(this, 'connected',
            {
                get: function () {
                    return _pdsession ? _pdsession.connected: undefined;
                },
                enumerable: true
            });        
                
        Object.defineProperty(this, 'JSDOs',
            {
                get: function () {
                    return _pdsession ? _pdsession.JSDOs: undefined;
                },
                enumerable: true
            });        
        
        Object.defineProperty(this, 'loginResult',
            {
                get: function () {
                    return _pdsession ? _pdsession.loginResult: undefined;
                },
                enumerable: true
            });        
        
        Object.defineProperty(this, 'loginHttpStatus',
            {
                get: function () {
                    return _pdsession ? _pdsession.loginHttpStatus: undefined;
                },
                enumerable: true
            });        
        
        Object.defineProperty(this, 'onOpenRequest',
            {
                get: function () {
                    return _pdsession ? _pdsession.onOpenRequest: undefined;
                },
                set: function (newval) {
                    if (_pdsession) {
                        _pdsession.onOpenRequest = newval;
                    }
                },
                enumerable: true
            });        
        
        Object.defineProperty(this, 'pingInterval',
            {
                get: function () {
                    return _pdsession ? _pdsession.pingInterval: undefined;
                },
                set: function (newval) {
                    if (_pdsession) {
                        _pdsession.pingInterval = newval;
                    }
                },
                enumerable: true
            });        
        
        Object.defineProperty(this, 'services',
            {
                get: function () {
                    return _pdsession ? _pdsession.services: undefined;
                },
                enumerable: true
            });        
        
        Object.defineProperty(this, 'serviceURI',
            {
                get: function () {
                    if (_pdsession && _pdsession.serviceURI) {
                        return _pdsession.serviceURI;
                    }
                    else {
                        return _serviceURI;
                    }
                },
                enumerable: true
            });        
        
        Object.defineProperty(this, 'userName',
            {
                get: function () {
                    return _pdsession ? _pdsession.userName: undefined;
                },
                enumerable: true
            });        
        
        
        // METHODS
        /*  login()
            Calls the progress.data.Session method, passing arguments that cause it to
            execute asynchronously. Throws an error if the underlying login call does not 
            make the async request, otherwise returns a promise.
         */
        this.login = function(username, password){
            var deferred = $.Deferred(),
                loginResult,
                errorObject;

            try {
                _pdsession.subscribe('afterLogin', onAfterLogin, this);
                
                loginResult = _pdsession.login(
                    { serviceURI : this.serviceURI,
                      userName : username, 
                      password : password, 
                      async : true,
                      deferred : deferred,
                      jsdosession : this} );
               
                if (loginResult !== progress.data.Session.ASYNC_PENDING) {
                    errorObject = new Error("JSDOSession: Unable to send login request.");
                }
            } 
            catch (e) {
                errorObject = new Error("JSDOSession: Unable to send login request. " + e.message);
            }
       
            if ( errorObject ) {
                throw errorObject;
            }
            else {
                return deferred.promise();
            }
        };
                            
        this.addCatalog = function( catalogURI, username, password ){
            var deferred = $.Deferred(),
                catalogURIs,
                errorObject;

            // check whether 1st param is a string or an array
            if ( typeof catalogURI == "string" ) {
                catalogURIs = [ catalogURI ];
            }
            else if ( catalogURI instanceof Array ) {
                catalogURIs = catalogURI;
            }
            else {
                throw new Error(progress.data._getMsgText("jsdoMSG033", "JSDOSession", "addCatalog", 
                       "The catalogURI parameter must be a string or an array of strings.") );
            }

            /* If the addCatalog results in an error (failure loading one or more of the catalogs), we 
               an array of results to the reject() method. We're attaching this array to the deferred object,
               in case the app makes multiple addCatalog calls (if the array was attached to the JSDOSession,
               the 2nd call might overwrite the first)
             */
            deferred._results = []; 
            try {                   
            
                // if a catalogURI has no protocol, pdsession will assume it's relative to the serviceURI,
                // if there has been a login
                // NOTE: this means if the app is trying to load a local catalog, it MUST
                // specify the file: protocol (and we need to make sure that works on all platforms)
             /*   TO DO
                for (var i = 0; i < catalogURIs.length; i++) {
                    var urlObject = $.mobile.path.parseUrl(catalogURIs[i]);
                    if (urlObject.protocol === "") {
                        if (catalogURIs[i].charAt(0) === "/")
                            catalogURIs[i] = _serviceURI + catalogURIs[i];
                        else
                            catalogURIs[i] = _serviceURI + "/" + catalogURIs[i];
                    }
                }                
            */    
                deferred._catalogIndex = 0;
                // make sure we subscribe only once!
                _pdsession.subscribe('afterAddCatalog', onAfterAddCatalog, this); 
                
                addResult = _pdsession.addCatalog(
                                   { catalogURI : catalogURIs[deferred._catalogIndex++],
                                     async : true,
                                     userName : username,
                                     password : password,
                                     deferred : deferred,
                                     jsdosession : this} );

                    /* NOTE: even though we may have been called with multiple catalogURIs, we only make one 
                    call to the Session.addcatalog from inside this function (the others are done from 
                    onAfterAddCatalog, for simplicity of code). So if we get back ASYNC_PENDING, we know
                    we can create a Deferred and returns its promise, and if we don't get ASYNC_PENDING,
                    we know there's no need for a Deferred and we can just throw an error
                  */
                if ( addResult !== progress.data.Session.ASYNC_PENDING ) {
                    errorObject = new Error("JSDOSession: Unable to send addCatalog request.");
                }
            }    
            catch (e) {
                errorObject = new Error("JSDOSession: Unable to send addCatalog request. " + e.message);
            }
            
            
            // TO_DO: JUST FORCE IT TO FAIL
            //errorObject = new Error("JSDOSession: Unable to send addCatalog request. " );
       
            if ( errorObject ) {
                throw errorObject;
            }
            else {
                return deferred.promise();
            }
        };
        
        this.logout = function(){
            var deferred = $.Deferred();
            
            
                // TO_DO
                // throw new Error("TEMP ERROR - REMOVE from logout" );

            try {
                _pdsession.subscribe('afterLogout', onAfterLogout, this);
                _pdsession.logout( {async: true,
                                    deferred : deferred,
                                    jsdosession : this} );
            } 
            catch (e) {
                throw new Error("JSDOSession: Unable to send logout request. " + e.message);
            }

            return deferred.promise();
        };       

        this.ping = function() {
            var deferred = $.Deferred();
            
            try {
                _pdsession.ping( {async: true,
                                  deferred : deferred,
                                  jsdosession : this,
                                  onCompleteFn : onPingComplete } );
            }
            catch(e) {
                throw new Error("JSDOSession: Unable to send ping request. " + e.message);                
            }

            return deferred.promise(); 
        };
        
        
        // PRIVATE FUNCTIONS
        function onAfterLogin ( pdsession, result, errorObject, xhr ) {
            if (xhr && xhr._deferred) {
                if (result === progress.data.Session.SUCCESS) {
                    xhr._deferred.resolve(   xhr._jsdosession, 
                                             result, 
                                             { errorObject: errorObject,
                                               xhr: xhr } );
                }
                else {
                    xhr._deferred.reject(   xhr._jsdosession, 
                                            result, 
                                            { errorObject: errorObject,
                                              xhr: xhr });
                }
            }     
        }

        function onAfterAddCatalog( pdsession, result, errorObject, xhr ) {
            /* TO DO: For multiple catalogs, make an entry in the array of results
                and keep going via a loop(?). Or maybe put the loop into the addCatalog method itself,
                but in any event, check in here whether we've done all the catalogs, and when we have, 
                call reject or resolve.
            */
            if (xhr && xhr._deferred) {
                /* add the result for this addCatalog to the result array. Do this even 
                   if this particular catalog was loaded successfully, because it may
                   just be one of several (we could check to see whether there was only
                   one catalog being loaded and, if so, not bother with the result array,
                   but why complicate the code?
                 */
                xhr._deferred._results.push( {catalogURI : xhr._catalogURI,
                                              result : result,
                                              errorObject : errorObject,
                                              xhr : xhr } );
                
                /* TO DO : only do this when all catalogs passed to this JSDOSession.addCatalog() 
                           call have been loaded
                           Otherwise, call the underlying Session addCatalog for the next catalog
                 */
                if (result === progress.data.Session.SUCCESS ||
                    result === progress.data.Session.CATALOG_ALREADY_LOADED) {
                    xhr._deferred.resolve( xhr._jsdosession, 
                                           progress.data.Session.SUCCESS,
                                           xhr._deferred._results );
                }
                else {
                    xhr._deferred.reject(  xhr._jsdosession, 
                                           progress.data.Session.GENERAL_FAILURE, 
                                           xhr._deferred._results ); 
                }
            }     

        }
        
        function onAfterLogout ( pdsession, errorObject, xhr ) {
            if (xhr && xhr._deferred) {
                /* Note: loginResult gets cleared on successful logout, so testing it for false
                         to confirm that logout succeeded
                 */
                 if ( !errorObject && !pdsession.loginResult ) {
                    xhr._deferred.resolve( xhr._jsdosession, 
                                           progress.data.Session.SUCCESS,
                                           { errorObject: errorObject, 
                                             xhr: xhr } );
                }
                else {
                    xhr._deferred.reject( xhr._jsdosession, 
                                          progress.data.Session.SUCCESS,
                                          { errorObject: errorObject, 
                                            xhr: xhr } );
                }
            }     
        }

        function onPingComplete( args ) {
            var xhr;
            if (args.xhr && args.xhr._deferred) {
                xhr = args.xhr;
                if ( args.pingResult ) {
                    xhr._deferred.resolve( xhr._jsdosession, 
                                           args.pingResult,
                                           { offlineReason: args.offlineReason, 
                                             xhr: xhr } );
                }
                else {
                    xhr._deferred.reject(  xhr._jsdosession, 
                                           args.pingResult,
                                           { offlineReason: args.offlineReason, 
                                             xhr: xhr } );
                }
            }     
        }

        this._onlineHandler = function( session, request ) {
            _myself.trigger( "online", _myself, request );            
        };    
        
        this._offlineHandler = function( session, offlineReason, request ) {
            _myself.trigger( "offline", _myself, offlineReason, request );            
        };    
        
        
        // PROCESS CONSTRUCTOR ARGUMENTS 
        // validate constructor input arguments
        if ( (arguments.length > 0) && (typeof(arguments[0]) === 'object') ) {
            
            // (options is the name of the arguments[0] parameter)
            if (options.serviceURI && (typeof(options.serviceURI) === "string" ) ) {
                _serviceURI = options.serviceURI;
            }
            else {
                throw new Error(progress.data._getMsgText("jsdoMSG033", "JSDOSession", "the constructor", 
                       "The options parameter must include a 'serviceURI' property that is a string.") );
            }

            if (options.authenticationModel) {
                if (typeof(options.authenticationModel) !== "string" ) {
                    throw new Error(progress.data._getMsgText("jsdoMSG033", "JSDOSession", "the constructor", 
                        "The authenticationModel property of the options parameter must be a string.") ); 
                }
            }
        }
        else {
            throw new Error(progress.data._getMsgText("jsdoMSG033", "JSDOSession", "the constructor", 
                "The options argument was missing or invalid.") );            
        }    
        
        _pdsession = new progress.data.Session();

        try {
            if (options.authenticationModel) {
                _pdsession.authenticationModel = options.authenticationModel;
            }
            _pdsession.subscribe( "online", this._onlineHandler, this);
            _pdsession.subscribe( "offline", this._offlineHandler, this);
        } catch (err) {
            _pdsession = undefined;  // so it will be garbage collected
            throw err;
        }
        
    };   // end of JSDOSession
    
//set up inheritance for JSDOSession -- specifically for incorporating an Observable object 
    progress.data.JSDOSession.prototype = new progress.util.Observable();
    progress.data.JSDOSession.prototype.constructor = progress.data.JSDOSession;
    function validateJSDOSessionSubscribe(args, evt, listenerData) {
        listenerData.operation = undefined;
        var found = false;

        // make sure this event is one that we support
        for (var i = 0; i < this._eventNames.length; i++) {
            if (evt === this._eventNames[i].toLowerCase()) {
                found = true;
                break;
            }
        }
        if (!found) {
            throw new Error(progress.data._getMsgText("jsdoMSG042", evt));
        }

        if (args.length < 2) {
            throw new Error(progress.data._getMsgText("jsdoMSG038", 2));
        }

        if (typeof args[0] !== 'string') {
            throw new Error(progress.data._getMsgText("jsdoMSG039"));
        }

        if (typeof args[1] !== 'function') {
            throw new Error(progress.data._getMsgText("jsdoMSG040"));
        }
        else {
            listenerData.fn = args[1];
        }

        if (args.length > 2) {
            if (typeof args[2] !== 'object') {
                throw new Error(progress.data._getMsgText("jsdoMSG041", evt));
            }
            else {
                listenerData.scope = args[2];
            }
        }
    }
    // events supported by JSDOSession
    progress.data.JSDOSession.prototype._eventNames = 
        ["offline", "online"];  
    // callback to validate subscribe and unsubscribe
    progress.data.JSDOSession.prototype.validateSubscribe = validateJSDOSessionSubscribe;
    progress.data.JSDOSession.prototype.toString = function (radix) {
        return "progress.data.JSDOSession";
    };
    
    
})();
