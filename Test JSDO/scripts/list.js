// Add data model for list page
function listDataSource(global) {
    myApp.listModel = kendo.observable({

        onInit: function (e) {
            myApp.listModel.initListView();
        },

        onBeforeShow: function (e) {
            if (!myApp.loginModel.isLoggedIn && jsdoSettings.authenticationModel != "Anonymous") {
                showError("Please login first");
            }
        },

        createJSDODataSource: function () {
            var jsdoDataSource,
                jsdo,
                resourceName;

            if (jsdoSettings.resourceName) {
                jsdoDataSource = new kendo.data.DataSource({
                    type: "jsdo",
                    transport: {
                        jsdo: jsdoSettings.resourceName
                    },
                    error: function (e) {
                        console.log("Error: ", e);
                    }
                });
            } else {
                console.log("Warning: jsdoSettings.resourceName not specified");
            }

            return jsdoDataSource;
        },

        initListView: function () {
            try {
                jsdoDataSource = myApp.listModel.createJSDODataSource();

                var fieldName = jsdoSettings.displayFields;
                if (fieldName && (idx = fieldName.indexOf(',')) != -1) {
                    console.log("List Page only displays first field from jsdoSettings.displayFields");
                    fieldName = fieldName.substring(0, idx);
                }

                if (!fieldName) {
                    console.log("Warning: jsdoSettings.displayFields not specified");
                }

                $("#my-list").kendoMobileListView({
                    dataSource: jsdoDataSource,
                    pullToRefresh: true,
                    appendOnRefresh: false,
                    template: "#: " + fieldName + " #"
                });
            } catch (ex) {
                console.log("Error in initListView: " + ex);
            }
        }
    });
}