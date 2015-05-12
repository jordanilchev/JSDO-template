

function jsdoSettingsProcessor() {
    if (typeof jsdoSettings === 'object') {   
	    if (jsdoSettings.authenticationModel  === undefined || jsdoSettings.authenticationModel  === "") {
            jsdoSettings.authenticationModel = "ANONYMOUS";
        } 
    }
}