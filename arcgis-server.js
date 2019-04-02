(function () {
  var myConnector = tableau.makeConnector();

  //Holds the schemas of table data to be delivered to Tableau
  var _tableSchemas = [];
    
  //Connection Info
  var _api_params = {
    url_type: '', //One of root, query, geojson
    base_url: '',
    token: '',
    username: '',
    services: [],
    folders: [],
    layers: [],
    schema_properties: [],
    protocol: 'https', //or http
    https_proxy_url: "http://localhost:8889/", //This one forwards requests to HTTPS endpoints only
    http_proxy_url: "http://localhost:8890/", //This one forwards requests to HTTP only
    json_format_querystirng: 'f=json',
    getRootListURL: function(folder) {
      if(folder) return this.root_list_url = this.proxy_url + this.base_url + "services/" + folder
      return  this.root_list_url = this.proxy_url + this.base_url;
    },
    service_url_pattern: "services/{servicename}/{servicetype}",
    getServiceURL: function(serviceObj) {
      return this.proxy_url + this.base_url + this.service_url_pattern.replace("{servicename}", serviceObj.name).replace("{servicetype}", serviceObj.type);
    },
    getProxyURL: function(url){
        return this.proxy_url + url;
    },
    setProtocol: function(p){
        if(p == "https"){
            this.proxy_url = this.https_proxy_url;
        }
        else if(p == "http"){
            this.proxy_url = this.http_proxy_url;
        }
    },
    formatForJSON: function(url){
      if(url.indexOf("?") > -1){
        return url + "&" + this.json_format_querystirng;
      }
      else{
        return url + "?" + this.json_format_querystirng;
      }
    },
    query_geojson_pattern: "/query?where=1%3D1&outFields=*&outSR=4326&f=json",
    queryLayerFormatForJSON: function(url){
        //Will format a layer's endpoint to add on the default query '/query?where=1%3D1&f=geojson' (brings back all records in geojson format)
        //If a query is passed in preserve its querystring options, and make sure we've got the minimum covered so it'll work properly
        
        if(url.indexOf("query?") > -1){
            //It's got some stuff after the ?
            var root = url.split("?")[0];
            var qs = url.split("?")[1]; //just the last part
            var qs_arr = qs.split("&");
            
            //Check for the required items

                if(qs.indexOf('where=') == -1){
                    //not there.  Add it
                    qs_arr.push('where=1%3D1')
                }

                if(qs.indexOf('outFields=') == -1){
                    //not there.  Add it
                    qs_arr.push('outFields=*')
                }

                if(qs.indexOf('outSR=') == -1){
                    //not there.  Add it
                    qs_arr.push('outSR=4326')
                }

                if(qs.indexOf('f=json') == -1){
                    //not there.  Add it
                    qs_arr.push('f=json')
                }
            
            //join 'em and send it out
            return root + "?" + qs_arr.join("&");
        }
        
        return url + this.query_geojson_pattern;
    }
  };

  myConnector.getSchema = function (schemaCallback) {
      
    //This is the main entry point.  When reusing the same connector for different URLs, make sure to reset all of the globals
    
      
    //The serialized info from the interactive page magically appears here in the tableau.connectionData property
    var user_info = JSON.parse(tableau.connectionData);
    _api_params.username = user_info.username;
    _api_params.password = user_info.password;
      
    var url = user_info.server_url;
    
    //Which protocol has been entered into the box?
    if(url.indexOf("https://") > -1){
        _api_params.setProtocol("https");
    } 
    else if(url.indexOf("http://") > -1){
        _api_params.setProtocol("http");
    }
      
    //replace http:// or https:// when we're using the proxy for dev
    url = url.replace("http://", "").replace("https://", "");  

    //Depending on what's entered in the textbox, decide how to handle it
    _api_params.url_type = parseURLForType(url);
      
    //Option 1 is an ArcGIS Server Root URL  /arcgis/rest/
    //Option 2 is a fulll path to a query output: https://services1.arcgis.com/1KAnay3h8WGQTI9I/arcgis/rest/services/oregon_state/FeatureServer/0/query?outFields=*&where=1%3D1
    //Option 3 is a URL to a geojson file
    
      
    if (_api_params.url_type == 'root'){
        _api_params.base_url = url;
        //Given the server url, go find all of the available datasources
        getSchemasFromRoot(function(){
            schemaCallback(_tableSchemas);
        });
    }
    else if(_api_params.url_type == 'query'){
        _api_params.layers.push({url: _api_params.getProxyURL(url)});
        getLayerSchemas(function(){
            schemaCallback(_tableSchemas);
        });
    }
    else if (_api_params.url_type == 'geojson'){
        //https://opendata.arcgis.com/datasets/c0881d0e88dc411a8b4bbe6b86526041_0.geojson
        _api_params.layers.push({url: _api_params.getProxyURL(url)});
        getLayerSchemasFromGeoJSON(function(){
            schemaCallback(_tableSchemas);
        });
    }


  };

  myConnector.getData = function (table, doneCallback) {

      getLayerRecords(table, function(){
          
          tableau.log("Finished Getting Layer Records, about to call donecallback();");
          doneCallback();
      })

  };

  tableau.registerConnector(myConnector);

  //Gets the expected schema per table. We'll have to flatten the JSON response a little to shoehorn it into this structure
  function getSchemasFromRoot(callback) {
      
      //Dynamically crawl the rest endpoint and see which resources have the Query capability, then generate a list and find out the field types to build the schema.
    discoverServices(function(){
        //Services have been stored in _api_params.services array.
        
        //We may also have picked up some folders, which need to be explored.  Do that now.
        discoverFolderizedServices(function(){
            
            //Now find out which ones have Layers with query endpoints and gather those up.
            discoverQueryableLayerEndpoints(function(){
                //Now, we have a bunch of layers(tables), each with different schemas.  Build up the table array.
                getLayerSchemas(function(){
                    callback();
                })
            })
        })
    })  
  }


  function discoverServices(callback){
      
    var url = _api_params.getRootListURL();
      
    //Then try to list styles and populate the dropdown
    $.getJSON(_api_params.formatForJSON(url), function (resp, txtstatus, jqxhr) {

        var server = resp;
        
      //Iterate over the JSON object
      //Should see currentVersion, folders, services
      //Focus on root level services for now. Find the query endpoints for layers.
        if (server && server.services){
          for (var i = 0, len = server.services.length; i < len; i++) {
             if(server.services[i].type == 'MapServer'){
                 //Bingo!  This is an endpoint that has queryable layers (probably). We want to expore it more.
                 _api_params.services.push(server.services[i]);
             }
          }
        }
        
        //Do folders too - folders hold services in an organized manner
        if (server && server.folders){
          for (var i = 0, len = server.folders.length; i < len; i++) {
            _api_params.folders.push(server.folders[i]);
          }
        }

        //Mission Accomplished
        callback();
      
    });
  }
    
    
  function discoverFolderizedServices(callback){
    
    var folder= _api_params.folders.pop();
        var url = '';
        if (folder) {
          url = _api_params.getRootListURL(folder);
        }
        else {
          //No more folders left.  Exit.  TODO: Add Error msg to callback if we hit it.
          callback();
          return;
        }

    //Get the list of services for the given folder
    $.getJSON(_api_params.formatForJSON(url), function (resp, txtstatus, jqxhr) {

        var server = resp;
        
      //Iterate over the JSON object
      //Should see currentVersion, folders, services    
        if (server && server.services){
          for (var i = 0, len = server.services.length; i < len; i++) {
             if(server.services[i].type == 'MapServer'){
                 //Bingo!  This is an endpoint that has queryable layers (probably). We want to expore it more.
                 _api_params.services.push(server.services[i]);
             }
          }
        }
        
        //If there are more folders, go back in and explore them.
        if (_api_params.folders.length > 0) {
           //Mission Accomplished
           discoverFolderizedServices(callback);
        }
        else {
           //Otherwise, get the heck out of here!
           callback();
           return;
        }
      
    });
  }

    
    //Gathers all of the the layer objects for services that have Query capabilities enabled
    function discoverQueryableLayerEndpoints(callback){
        var service= _api_params.services.pop();
        var url = '';
        if (service) {
          url = _api_params.getServiceURL(service);
        }
        else {
          //No more services left.  Exit.  TODO: Add Error msg to callback if we hit it.
          callback();
          return;
        }

        //Then try to get the list of layers from this service
        $.getJSON(_api_params.formatForJSON(url), function (resp, txtstatus, jqxhr) {

            var serviceResponse = resp;

          // Iterate over the JSON object
          //Should see currentVersion, serviceDescription, mapName, description, copyrightText, supportsDynamicLayers, layers, tables, spatialReference, singleFusedMapCache, initialExtent, fullExtent, minScale, maxScale, units, supportedImageFormatTypes, documentInfo, capabilities (Query is there!), supportedQueryFormats, exportTilesAllowed, maxRecordCount (for paging), maxImageHeight, maxImageWidth, supportedExtensions
            
            //TODO: Note layers can have sub layers.  If that's so, then you'll need to go back and find out what they are with another query.
            //Skip for now.

          //Find out if we can query these joints
            if (serviceResponse && serviceResponse.capabilities){
                if(serviceResponse.capabilities.indexOf("Query") > -1){
                    //We can query these layers.  Add them to a list
                    if (serviceResponse && serviceResponse.layers){
                        for (var i = 0, len = serviceResponse.layers.length; i < len; i++) {
                            if(_api_params.layers.length > 50) {
                                callback(); 
                                return;
                            }
                            serviceResponse.layers[i].url = url + "/" + serviceResponse.layers[i].id; //take the service url defined above and stick the layer id to the end.  That'll be the layer query url we'll use later to grab the schema.
                            _api_params.layers.push(serviceResponse.layers[i])
                        }
                    }
                }
            }
            
            //Experimental - See if there are any WMTS endpoints here as well
            if(serviceResponse && serviceResponse.singleFusedMapCache && serviceResponse.singleFusedMapCache == true){
                //If there's a singleFusedMapCache, then there should be a WMTS endpoint (I think).
                //http://gis3.nve.no/arcgis/rest/services/wmts/Bratthet/MapServer/
                if(serviceResponse.spatialReference){
                    var srid = serviceResponse.spatialReference.latestWkid || serviceResponse.spatialReference.wkid;
                    if(srid == '3857' || srid == '102100'){
                        //We're good. If it's any other srid, we can't use it.
                        
                    }
                } 
            }

            //If there are more services with layers, keep digging.
            if (_api_params.services.length > 0) {
                //Mission Accomplished
                discoverQueryableLayerEndpoints(callback);
            }
            else {
                callback();
                return;
            }

        });
    }
    
    
  //Get info about each layer/table
  function getLayerSchemas(callback) {
    var layer = _api_params.layers.pop();
    var url = '';
    if (layer) {
      url = layer.url;
    }
    else {
        //No more styles left.  Exit.  TODO: Add Error msg to callback if we hit it.
      callback();
      return;
    }

    $.getJSON(_api_params.formatForJSON(url), function (resp, txtstatus, jqxhr) {
      var summary = resp;
      var columns = [];
      var spatialColumnName = "";
        
      // Iterate over the JSON object and coerce the schema into a format that Tableau expects (flat)
      //Get out of here if this is a polyline.  Tableau doesn't know anything about that for now.    
      if (summary.geometryType != 'esriGeometryPolyline'){
          if (summary && summary.fields) {
            //Iterate over the field inforamtion and build up the schema definition
            for (var i = 0, len = summary.fields.length; i < len; i++) {
              layer = summary.fields[i];
              columns.push({
                id: formatColumnNames(layer.name),
                alias: layer.alias,
                dataType: getTableauColumnType(layer.type),
              });
              if(layer.type === "esriFieldTypeGeometry"){
                  spatialColumnName = layer.name;
              }
            }
          }
          
          //See if we captured a spatial column.  If not, add it to the schema with the default 'Geometry' name.  Like from GeoJSON.
          if (spatialColumnName == ""){
             columns.push({
                id: "Geometry",
                alias: "Geometry",
                dataType: getTableauColumnType("esriFieldTypeGeometry"),
              }) 
              
              spatialColumnName = "Geometry";
          }

          //Add the layer/table name to the master table list
          //Only add table if column length is > 0
          //If we're reading directly from a query endpoint, there is no summary.name.  You have to pull it from the URL.  Ugh.
          var table_name = "";
          if(_api_params.url_type == "root"){
              table_name = summary.name;
          }
          else if(_api_params.url_type == "query"){
              table_name = findServiceNameFromURL(url);
          }
          else if(_api_params.url_type == "geojson"){
              //No table name (for display in the data pane in Tableau)
          }

          
          if(columns.length > 0){
              _tableSchemas.push({
                  id: formatColumnNames(table_name), 
                  alias: table_name,
                  columns: columns
              })

              var schema_properties = {
                  query_url: _api_params.queryLayerFormatForJSON(url),
                  spatial_column: spatialColumnName
              }

              _api_params.schema_properties[formatColumnNames(table_name)] = schema_properties;  
          }
      }

      //If there are more layers, go get 'em
      if (_api_params.layers.length > 0) {
        getLayerSchemas(callback);
      }
      else {
        callback();
        return;
      }
    });
  }
  
    
    
  //Get info about the geojson schema
  function getLayerSchemasFromGeoJSON(callback) {
    var layer = _api_params.layers.pop();
    var url = '';
    if (layer) {
      url = layer.url;
    }
    else {
        //No more styles left.  Exit.  TODO: Add Error msg to callback if we hit it.
      callback();
      return;
    }

    $.getJSON(url, function (resp, txtstatus, jqxhr) {
      var summary = resp;
      var columns = [];
      var spatialColumnName = "";
        
      // Iterate over the JSON object and coerce the schema into a format that Tableau expects (flat)
      //Get out of here if this is a polyline.  Tableau doesn't know anything about that as for now.    
      if (summary.features[0].type.toLowerCase() != 'polyline' && summary.features[0].type.toLowerCase() != 'multilinestring'){
          var fields = Object.keys(summary.features[0].properties);
          
          for (var i = 0, len = fields.length; i < len; i++) {
              columns.push({
                id: formatColumnNames(fields[i]), //names and aliases have to be alphanumeric only.  No spaces or characters.
                alias: fields[i],
                dataType: getTableauColumnTypeFromGeoJSON(typeof(summary.features[0].properties[fields[i]]))
              });
            }
          
          //Add spatial column to the schema with the default 'Geometry' name.

          columns.push({
            id: "Geometry",
            alias: "Geometry",
            dataType: getTableauColumnTypeFromGeoJSON("geometry")
          }) 
              
          spatialColumnName = "Geometry";
          
          //Add the layer/table name to the master table list.  Just call it GeoJSON
          var table_name = "GeoJSON";
     
          if(columns.length > 0){
              _tableSchemas.push({
                  id: table_name, 
                  alias: table_name,
                  columns: columns
              })

              var schema_properties = {
                  query_url: url,
                  spatial_column: spatialColumnName
              }

              _api_params.schema_properties[formatColumnNames(table_name)] = schema_properties;  
          }
      }

      //Any more layers?  Go get 'em
      if (_api_params.layers.length > 0) {
        getLayerSchemas(callback);
      }
      else {
        callback();
        return;
      }
    });
  }
    

  //Query REST endpoint for a given layer
  function getLayerRecords(tableObj, callback) {

    var url = '';
    var schema_properties;
    if (tableObj && tableObj.tableInfo) {
      schema_properties = _api_params.schema_properties[tableObj.tableInfo.id];
      url = schema_properties.query_url;
    }
    else {
        //No more styles left.  Exit.  TODO: Add Error msg to callback if we hit it.
      callback();
      return;
    }

    $.getJSON(url, function (resp, txtstatus, jqxhr) {
    

    var geojson = "";
      if(_api_params.url_type == 'root' || _api_params.url_type == 'query'){
          geojson = arcgisToGeoJSON(resp); //Convert esriJSON to geojson.
      }
      else if(_api_params.url_type == 'geojson'){
          geojson = resp; //It's already geojson.  No need to convert.
      }
              
      var summary = geojson;
      var features = summary.features;
      var rows = [];
        
      // Iterate over the JSON object and coerce the schema into a format that Tableau expects (flat)
      if (features && features.length > 0 && tableObj) {
        //Grab a list of the properties
        var properties = features[0].properties;
          
        for (var i = 0, len = features.length; i < len; i++) {
            var row_builder = {};
            for (var property_name in properties){
                    
                    row_builder[formatColumnNames(property_name)] = features[i].properties[(property_name)];
            }
            
            //Grab geometry
            if(features[i].geometry){
               row_builder[schema_properties.spatial_column] = features[i].geometry; 
            }
            
            //Commit row
            rows.push(row_builder);
        }
      }


      //Only add the row if it isn't empty
      if(rows.length > 0){
        tableObj.appendRows(rows);
      }

      //TODO:  Determine if we need to grab more features with a followup call.  ArcGIS Server limits queries to 1000 results by default, though this is configurable by the server administrator.  Different versions of ArcGIS Server have paging capability, where you can specify a starting record and the number of records to fetch, but not all.  The trick is to first query the endpoint and get back all of the ObjectIDs (there is no limit on this query).  Then you sort the IDs and do your own paging.  Ugh.
      //if (_api_params.layers.length > 0) {
      //  getLayerSchemas(callback);
      //}
      //else {
        callback();
        return;
      //}
    });
  }
    
    
  //Return root, query or geojson    
  function parseURLForType(url){
      
      //If the URl ends in arcgis/rest/, then let's assume it's of type 'root'.  //TODO:  Many ArcGIS Server instances follow this rule, but some don't (Admins can configure the URL structure to be different than the default.)
      if(url.endsWith("arcgis/rest/") === true){
          return 'root';
      }
      else if(url.indexOf("arcgis/rest/") > -1 && url.indexOf("FeatureServer") > -1 && url.indexOf("query?") > -1){
          return 'query';        
      }
      else if (url.endsWith(".geojson") === true){
          return 'geojson';
      }
      else{
          return 'root';
      }
     
  }
  
    
  //for a query type URL, we can grab the name from the URL.  It's after rest/services
  function findServiceNameFromURL(url){
      var s = url.split("/");
      return s[s.indexOf("services") + 1]; //Get the value at index of the array that holds the token immediately after /services/
  }

  //Clean up layer names that are used as table names for Tableau. Only allow alphanumeric table names.
  function formatColumnNames(input){
      return input.replace(/[^a-z0-9]/gi,'');
  }

  function getTableauColumnType(esriType){

      //esriFieldTypeBlob, esriFieldTypeRaster not supported, 'cause it doesn't map to a Tableau type.
      //TODO:  Make this fail gracefully if you can't find the right match, or if somehting changes, or if there is no type passed in.
      var map = {
          "esriFieldTypeOID": tableau.dataTypeEnum.int,
          "esriFieldTypeInteger": tableau.dataTypeEnum.int,
          "esriFieldTypeSmallInteger": tableau.dataTypeEnum.int,
          "esriFieldTypeDouble": tableau.dataTypeEnum.float,
          "esriFieldTypeSingle": tableau.dataTypeEnum.float,
          "esriFieldTypeString": tableau.dataTypeEnum.string,
          "esriFieldTypeDate": tableau.dataTypeEnum.date,
          "esriFieldTypeGeometry": tableau.dataTypeEnum.geometry,
          "esriFieldTypeGUID": tableau.dataTypeEnum.string,
          "esriFieldTypeGlobalID": tableau.dataTypeEnum.string,
          "esriFieldTypeXML": tableau.dataTypeEnum.string
      }

      if(map[esriType]){
          return map[esriType];
      }
      else{
          console.log("ESRI Type " + esriType + " not found. Add it.")
          return tableau.dataTypeEnum.string;
      }

  }
    
    
  function getTableauColumnTypeFromGeoJSON(jsType){

      //using javascript typeof to get bool, number, string
      //TODO:  Make this fail gracefully if you can't find the right match, or if somehting changes, or if there is no type passed in.
      var map = {
          "number": tableau.dataTypeEnum.float,
          "string": tableau.dataTypeEnum.string,
          "bool": tableau.dataTypeEnum.string,
          "geometry": tableau.dataTypeEnum.geometry
      }

      if(map[jsType]){
          return map[jsType];
      }
      else{
          console.log("Javascript Type " + jsType + " not found. Add it.")
          return tableau.dataTypeEnum.string;
      }

  }
    
    
    
$(document).ready(function () {
  $('#submitButton').click(function () {
    //Gather up what tables the user wanted
      
    var user_info = {
        username: "",
        password: "",
        server_url: ""
    }
    
    //TODO: Validate that username and token are populated  
    if ($('#txtServerURL').val() != '') {
      user_info.server_url = $('#txtServerURL').val();
    }
    else {
      //Display message to fill in username
      return;
    }
    
    //TODO: Validate that username and token are populated  
    if ($('#txtUsername').val() != '') {
      user_info.username = $('#txtUsername').val();
    }
    else {
      //Display message to fill in username
      return;
    }

        //Validate that user has entered username and API Token
    if ($('#txtAPIToken').val() != '') {
      user_info.token = $('#txtAPIToken').val();
    }
    else {
            //Display message to fill in username

      return;
    }
      
    //Before the interactive page goes away (it will when we 'submit' in a sec.), stash the user's token and username (as a string) in the talbeau.connectionData property to pass it over to the so-called 'Gather data' phase, where we'll actually pull the schema and data.
    tableau.connectionData = JSON.stringify(user_info);
      
    tableau.connectionName = 'ESRI ArcGIS Server';
    tableau.submit();
  });
        
});
     
})();
