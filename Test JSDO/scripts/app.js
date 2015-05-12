var myApp = function () {
    var jsdoDataSource,
        jsdosession,
        app,
        loginModel = new loginDataSource(),
        listModel = new listDataSource();

    document.addEventListener("deviceready", initialize);
};

function initialize() {
    try {
        jsdoSettingsProcessor();

        if (!jsdoSettings.authenticationModel) {
            console.log("Warning: jsdoSettings.authenticationModel not specified. Default is ANONYMOUS");
        }

        jsdosession = new progress.data.JSDOSession(jsdoSettings);
    } catch (ex) {
        console.log("Error creating JSDOSession: " + ex);
    }

    if (!showLoginPage()) {
        // Login as anonymous automatically, data will be available on list page
        $('#loginIcon').hide();
        myApp.loginModel.login();
    }

    app = new kendo.mobile.Application(document.body, {
        skin: "flat",
        transition: 'slide',
        initial: "views/home.html",
        layout: "tabstrip-layout"
    });
};

myApp.prototype = new baseApp();