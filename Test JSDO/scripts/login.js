// Add data model for login page
function loginDataSource (global) {
     myApp.loginModel = kendo.observable({
        username: "",
        password: "",
        
         login: function(e) {    
            var that = this;
            try { 
                var promise = jsdosession.login(this.get("username"), this.get("password"));
                promise.done( function( jsdosession, result, info ) {
                    try { 
                        console.log("Success on login()");   
                        that.set("isLoggedIn", true);
                        myApp.loginModel.onBeforeShow( );
                        var catPromise = jsdosession.addCatalog(jsdoSettings.catalogURIs);
                        catPromise.done( function( jsdosession, result, details ) { 
                            console.log("Success on addCatalog()");            
                         });
                        
                        catPromise.fail( function( jsdosession, result, details) {
                            myApp.loginModel.addCatalogErrorFn(jsdosession, 
                                                    progress.data.Session.GENERAL_FAILURE, details);
                        });  
                    } 
                    catch(ex) {
                       var details = [{"catalogURI": jsdoSettings.catalogURIs, errorObject: ex}];
                       myApp.loginModel.addCatalogErrorFn(jsdosession, 
                                                    progress.data.Session.GENERAL_FAILURE, details);
                    } 
 
                });
                
              
               promise.fail( function(jsdosession, result, info) {
                    myApp.loginModel.loginErrorFn(jsdosession, result, info);
                }); // end promise.fail
            }
            catch(ex) {
               myApp.loginModel.loginErrorFn(jsdosession, progress.data.Session.GENERAL_FAILURE, 
                                                    {errorObject: ex});
            } 
        },
         
        logout: function(e) {
            if (e) {
                e.preventDefault();
            }
            var that = this;
            try {
                var promise = jsdosession.logout();
                promise.done( function(jsdosession, result, info) {
                    console.log("Success on logout()"); 
             		that.set("isLoggedIn", false);
                    myApp.loginModel.onBeforeShow( );
                    app.navigate("views/login.html");            
                });
                promise.fail( function(jsdosession, result, info) {
                     myApp.listModel.logoutErrorFn(jsdosession, result, info);
                });              
            }
            catch(ex) {
               myApp.listModel.logoutErrorFn(jsdosession, progress.data.Session.GENERAL_FAILURE, 
                                                        {errorObject: ex});
            } 
        },
 
		checkEnter: function (e) {
            var that = this;
            if (e.keyCode == 13) {
                $(e.target).blur();
                that.login();
            }
        },
        
        onBeforeShow: function(e){
            // Always clear password
            myApp.loginModel.set("password", "");
            // If logged in, show welcome message
            if (myApp.loginModel.isLoggedIn) {
                $("#loginIcon").parent().hide();
                $("#credentials").parent().hide();
                $("#username").parent().hide();
                $("#password").parent().hide();
                $("#welcome").parent().show();
            } else {
                //else show login screen
                myApp.loginModel.set("username", "");
                $("#loginIcon").parent().show();
                $("#credentials").parent().show();
                $("#username").parent().show();
                $("#password").parent().show();
                $("#welcome").parent().hide();            }
         },
         
        addCatalogErrorFn: function(jsdosession, result, details) {
            console.log("Error on addCatalog()");            
            var msg = "";
            if (details !== undefined  && Array.isArray(details)){
                for (var i = 0; i < details.length; i++){
                    msg = msg + "\n" + details[i].errorObject;
                }
            }
            showError(msg);
            console.log(msg);   
            // Now logout
            if (myApp.loginModel.isLoggedIn) { 
                myApp.loginModel.logout();
            }
        },
        
        logoutErrorFn: function(jsdosession, result, info) {
            var msg = "Error on logout";
            showError(msg);
            if (info.errorObject !== undefined) {
                msg = msg + "\n" + info.errorObject;
            }
            if (info.xhr) {
                msg = msg + "\n" + "status (from jqXHT):" + info.xhr.status;
                msg = msg + " statusText (from jqXHT):" + info.xhr.statusText;
            }
            console.log(msg);
        },

         loginErrorFn: function(jsdosession, result, info) {
            console.log("Error on login");
            var msg = "";
            switch (result) {
                case progress.data.Session.LOGIN_AUTHENTICATION_FAILURE:
                    msg = "Invalid userid or password";
                    break;
                case progress.data.Session.LOGIN_GENERAL_FAILURE:
                default:
                    msg = "Service is unavailable";
                    break;
            }       
            showError(msg);
            if (info.xhr) {
                msg = msg + " status (from jqXHT):" + info.xhr.status;
                msg = msg + " statusText (from jqXHT):" + info.xhr.statusText;
                if (info.xhr.status == 200) {
                    //something is likely wrong with the catalog, so dump it out     
                    msg = msg + "\nresponseText (from jqXHT):" + xhr.responseText;
                }
            }
            if (info.errorObject) {
                msg = msg + "\n" + info.errorObject;
            }
            console.log(msg);
        }
    });  
}