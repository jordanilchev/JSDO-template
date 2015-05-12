
var baseApp = function(){};

baseApp.prototype = function() {

	showLoginPage = function () {        
        // authenticationModel defaults to "ANONYMOUS"
        if (!jsdoSettings.authenticationModel || 
             jsdoSettings.authenticationModel.toUpperCase() === "ANONYMOUS") {
            return false;
        } 
        else {
            return true;
        }
	};

	showError = function (message){
        navigator.notification.alert(message);
	};
     
}();

