(function () {
  var myConnector = tableau.makeConnector();

    //Holds the tables of data to be delivered to Tableau
  var _tableData = {
      styles: [],
      accounts: [],
      tilesets: [],
      tokens: []
  };

  myConnector.getSchema = function (schemaCallback) {
        //There are 4 types of info available from the analytics API: accounts, tokens, styles, tilesets
        //For now, just grab all of them
    var schemas = getSchemas();

    schemaCallback(schemas);
  };

  myConnector.getData = function (table, doneCallback) {
      
    //The serialized info from the interactive page magically appears here in the tableau.connectionData property
      
    var user_info = JSON.parse(tableau.connectionData);
    api_params.username = user_info.username;
    api_params.token = user_info.token;
      
    if (table && table.tableInfo.id == 'MapboxStyles') {
      //Get the list of styles
      getStyleJSONList(api_params.getStyleURL(), function () {
        //after we get a list of styles, then get the summaries for each and build a table
        getStyleJSONSummary(function () {
             table.appendRows(_tableData.styles);
             doneCallback();
        });
      });
    }
    else if(table && table.tableInfo.id == 'MapboxAccounts'){
        getAccountJSONSummary(function () {
             table.appendRows(_tableData.accounts);
             doneCallback();
        });
    }
    else if(table && table.tableInfo.id == 'MapboxTokens'){
      //Get the list of tokens
      getTokenJSONList(api_params.getTokenListURL(), function () {
        //after we get a list of tokens, then get the summaries for each and build a table
        getTokenJSONSummary(function () {
             table.appendRows(_tableData.tokens);
             doneCallback();
        });
      });   
    }
    else if(table && table.tableInfo.id == 'MapboxTilesets'){
      //Get the list of tilesets
      getTilesetJSONList(api_params.getTilesetListURL(), function () {
        //after we get a list of tilesets, then get the summaries for each and build a table
        getTilesetJSONSummary(function () {
             table.appendRows(_tableData.tilesets);
             doneCallback();
        });
      });
    }
  };

  tableau.registerConnector(myConnector);

        //Gets the expected schema per table. We'll have to flatten the JSON response a little to shoehorn it into this structure
  function getSchemas() {
    var schemas =
      {
        'accounts': [{
          id: 'timestamp',
          dataType: tableau.dataTypeEnum.datetime,
        }, {
          id: 'accountname',
          alias: 'AccountName',
          dataType: tableau.dataTypeEnum.string,
        }, {
          id: 'mapviews',
          alias: 'MapViews',
          dataType: tableau.dataTypeEnum.int,
        }, {
          id: 'tileviews',
          alias: 'TileViews',
          dataType: tableau.dataTypeEnum.int,
        }, {
          id: 'staticviews',
          alias: 'StaticViews',
          dataType: tableau.dataTypeEnum.int,
        }, {
          id: 'geocodes',
          alias: 'Geocodes',
          dataType: tableau.dataTypeEnum.int,
        }, {
          id: 'directions',
          alias: 'DirectionsRequests',
          dataType: tableau.dataTypeEnum.int,
        }, {
          id: 'mobileusers',
          alias: 'MobileUsers',
          dataType: tableau.dataTypeEnum.int,
        }],
        'tokens': [{
          id: 'timestamp',
          dataType: tableau.dataTypeEnum.datetime,
        }, {
          id: 'tokenid',
          alias: 'TokenId',
          dataType: tableau.dataTypeEnum.string,
        }, {
          id: 'tokenname',
          alias: 'TokenName',
          dataType: tableau.dataTypeEnum.string,
        }, {
          id: 'mapviews',
          alias: 'MapViews',
          dataType: tableau.dataTypeEnum.int,
        }, {
          id: 'tileviews',
          alias: 'TileViews',
          dataType: tableau.dataTypeEnum.int,
        }, {
          id: 'staticviews',
          alias: 'StaticViews',
          dataType: tableau.dataTypeEnum.int,
        }, {
          id: 'geocodes',
          alias: 'Geocodes',
          dataType: tableau.dataTypeEnum.int,
        }, {
          id: 'directions',
          alias: 'DirectionsRequests',
          dataType: tableau.dataTypeEnum.int,
        }],
        'styles': [{
          id: 'timestamp',
          dataType: tableau.dataTypeEnum.datetime,
        }, {
          id: 'styleid',
          alias: 'StyleId',
          dataType: tableau.dataTypeEnum.string,
        }, {
          id: 'stylename',
          alias: 'StyleName',
          dataType: tableau.dataTypeEnum.string,
        }, {
          id: 'mapviews',
          alias: 'MapViews',
          dataType: tableau.dataTypeEnum.int,
        }, {
          id: 'tileviews',
          alias: 'TileViews',
          dataType: tableau.dataTypeEnum.int,
        }, {
          id: 'staticviews',
          alias: 'StaticViews',
          dataType: tableau.dataTypeEnum.int,
        }],
        'tilesets': [{
          id: 'timestamp',
          dataType: tableau.dataTypeEnum.datetime,
        }, {
          id: 'tilesetid',
          alias: 'TilesetId',
          dataType: tableau.dataTypeEnum.string,
        }, {
          id: 'tilesetname',
          alias: 'TilesetName',
          dataType: tableau.dataTypeEnum.string,
        }, {
          id: 'mapviews',
          alias: 'MapViews',
          dataType: tableau.dataTypeEnum.int,
        }, {
          id: 'tileviews',
          alias: 'TileViews',
          dataType: tableau.dataTypeEnum.int,
        }, {
          id: 'staticviews',
          alias: 'StaticViews',
          dataType: tableau.dataTypeEnum.int,
        }],
      };

    var tableSchemas = [{
      id: 'MapboxAccounts',
      alias: 'AccountStatistics',
      columns: schemas.accounts,
    },
      {
        id: 'MapboxTokens',
        alias: 'TokenStatistics',
        columns: schemas.tokens,
      },
      {
        id: 'MapboxStyles',
        alias: 'RasterStyleStatistics', //For now, the styles statistical API only returns static map draws and raster tile requests
        columns: schemas.styles,
      },
      {
        id: 'MapboxTilesets',
        alias: 'TilesetStatistics',
        columns: schemas.tilesets,
      }];

    return tableSchemas;
  }


    //Connection Info
  var api_params = {
    base_url: 'https://api.mapbox.com',
    token: '',
    resource_types: ['accounts', 'tokens', 'tilesets', 'styles'],
    resource_id: '',
    username: '',
    date_period: ['2018-03-22T00:00:00.000Z', '2018-03-24T00:00:00.000Z'],
    styles_url_pattern: '/styles/v1/{username}?access_token={api_token}',
    getStyleURL: function() {
      this.style_url = this.base_url + this.styles_url_pattern.replace('{username}', this.username).replace('{api_token}', this.token);
      return this.style_url;
    },
    setStyleURL: function(url) {
      if (url.indexOf('?') > 0) {
        this.style_url = url + '&access_token={api_token}'.replace('{api_token}', this.token);
      }
      else {
        this.style_url = url + '?access_token={api_token}'.replace('{api_token}', this.token);
      }
      return this.style_url;
    },
    period_url_pattern: 'period={period}',
    analytics_url_pattern: '/analytics/v1/{resource_type}/{username}/{id}?access_token={api_token}',
    getStyleAnalyticsURL: function(styleId) {
      return this.base_url + this.analytics_url_pattern.replace('{username}', this.username).replace('{api_token}', this.token).replace('{resource_type}', 'styles').replace('{id}', styleId);
    },
    styleList: [], //Once we get a list of all styles, populate this
    tilesetList: [], //Once we get a list of all tilesets, populate this
    tokenList: [],//Once we get a list of all tokens, populate this
    account_url_pattern: '/analytics/v1/accounts/{username}?access_token={api_token}',
    getAccountAnalyticsURL: function() {
      return this.base_url + this.account_url_pattern.replace('{username}', this.username).replace('{api_token}', this.token);
    },
    tileset_list_url_pattern: '/tilesets/v1/{username}?access_token={api_token}',
    getTilesetListURL: function() {
      this.tileset_url = this.base_url + this.tileset_list_url_pattern.replace('{username}', this.username).replace('{api_token}', this.token);
      return this.tileset_url;
    },
    setTilesetURL: function(url) {
      if (url.indexOf('?') > 0) {
        this.tileset_url = url + '&access_token={api_token}'.replace('{api_token}', this.token);
      }
      else {
        this.tileset_url = url + '?access_token={api_token}'.replace('{api_token}', this.token);
      }
      return this.tileset_url;
    },
    getTilesetAnalyticsURL: function(tilesetId) {
      return this.base_url + this.analytics_url_pattern.replace('{username}', this.username).replace('{api_token}', this.token).replace('{resource_type}', 'tilesets').replace('{id}', tilesetId);
    },
    token_list_url_pattern: '/tokens/v2/{username}?access_token={api_token}', //note the v2 there in the api call.  No v1 endpoint
    getTokenListURL: function() {
      this.token_url = this.base_url + this.token_list_url_pattern.replace('{username}', this.username).replace('{api_token}', this.token);
      return this.token_url;
    },
    setTokenURL: function(url) {
      if (url.indexOf('?') > 0) {
        this.token_url = url + '&access_token={api_token}'.replace('{api_token}', this.token);
      }
      else {
        this.token_url = url + '?access_token={api_token}'.replace('{api_token}', this.token);
      }
      return this.token_url;
    },
    getTokenAnalyticsURL: function(tokenId) {
      return this.base_url + this.analytics_url_pattern.replace('{username}', this.username).replace('{api_token}', this.token).replace('{resource_type}', 'tokens').replace('{id}', tokenId);
    }
  };



  //Allows for recursive JSON calling for paged Mapbox API Responses
  function getStyleJSONList(url, callback) {
        //Then try to list styles and populate the dropdown
    $.getJSON(url, function (resp, txtstatus, jqxhr) {
      var stylesList = resp;
      var header = jqxhr.getResponseHeader('link');
      var next_url = '';

      //If Mapbox has more results, it'll include a link to the next set in the response headers.
      if (header) {
        next_url = header.split(';')[0].replace('<', '').replace('>', '');
      }


      // Iterate over the JSON object
      for (var i = 0, len = stylesList.length; i < len; i++) {
        api_params.styleList = api_params.styleList.concat(stylesList[i]); //Keep adding the results to the same array
      }

      if (next_url != '') {
        getStyleJSONList(api_params.setStyleURL(next_url), callback);
      }
      else {
        //Mission Accomplished
        callback();
      }
    });
  }

  //Get info on the provided list of styles
  function getStyleJSONSummary(onComplete) {
    var style= api_params.styleList.pop();
    var url = '';
    if (style) {
      url = api_params.getStyleAnalyticsURL(style.id);
    }
    else {
            //No more styles left.  Exit.  TODO: Add Error msg to callback if we hit it.
      onComplete();
      return;
    }

    $.getJSON(url, function (resp, txtstatus, jqxhr) {
      var stylesSummary = resp;
      var tempList = [];

            // Iterate over the JSON object and force it into the schema that Tableau expects (flat)
      if (stylesSummary && stylesSummary.timestamps) {
        for (var i = 0, len = stylesSummary.timestamps.length; i < len; i++) {
          tempList.push({ 
             'timestamp': stylesSummary.timestamps[i],
             'styleid': style.id,
             'stylename': style.name,
             'mapviews': stylesSummary.services.mapview[i],
             'tileviews': stylesSummary.services.tile[i],
             'staticviews': stylesSummary.services.static[i],
          });
        }
      }


      _tableData.styles = _tableData.styles.concat(tempList);

      if (api_params.styleList.length > 0) {
        getStyleJSONSummary(onComplete);
      }
      else {
        onComplete();
        return;
      }
    });
  }
    
    
    
    
//Allows for recursive JSON calling for paged Mapbox API Responses
  function getTilesetJSONList(url, callback) {
    //Then try to list styles and populate the dropdown
    $.getJSON(url, function (resp, txtstatus, jqxhr) {
      var tilesetList = resp;
      var header = jqxhr.getResponseHeader('link');
      var next_url = '';

      //If Mapbox has more results, it'll include a link to the next set in the response headers.
      if (header) {
        next_url = header.split(';')[0].replace('<', '').replace('>', '');
      }


      // Iterate over the JSON object
      for (var i = 0, len = tilesetList.length; i < len; i++) {
        api_params.tilesetList = api_params.tilesetList.concat(tilesetList[i]); //Keep adding the results to the same array
      }

      if (next_url != '') {
        getTilesetJSONList(api_params.setTilesetURL(next_url), callback);
      }
      else {
        //Mission Accomplished
        callback();
      }
    });
  }

  //Get info on the provided list of tilesets
  function getTilesetJSONSummary(onComplete) {
    var tileset= api_params.tilesetList.pop();
    var url = '';
    if (tileset) {
      url = api_params.getTilesetAnalyticsURL(tileset.id);
    }
    else {
            //No more tilesets left.  Exit.  TODO: Add Error msg to callback if we hit it.
      onComplete();
      return;
    }

    $.getJSON(url, function (resp, txtstatus, jqxhr) {
      var tilesetSummary = resp;
      var tempList = [];

            // Iterate over the JSON object and force it into the schema that Tableau expects (flat)
      if (tilesetSummary && tilesetSummary.timestamps) {
        for (var i = 0, len = tilesetSummary.timestamps.length; i < len; i++) {
          tempList.push({ 
             'timestamp': tilesetSummary.timestamps[i],
             'tilesetid': tileset.id,
             'tilesetname': tileset.name,
             'mapviews': tilesetSummary.services.mapview[i],
             'tileviews': tilesetSummary.services.tile[i],
             'staticviews': tilesetSummary.services.static[i],
          });
        }
      }


      _tableData.tilesets = _tableData.tilesets.concat(tempList);

      if (api_params.tilesetList.length > 0) {
        getTilesetJSONSummary(onComplete);
      }
      else {
        onComplete();
        return;
      }
    });
  }
    
    
  //Allows for recursive JSON calling for paged Mapbox API Responses.  Only public tokens will bring back the actual token string.
  function getTokenJSONList(url, callback) {
    //list tokens
    $.getJSON(url, function (resp, txtstatus, jqxhr) {
      var tokenList = resp;
      var header = jqxhr.getResponseHeader('link');
      var next_url = '';

      //If Mapbox has more results, it'll include a link to the next set in the response headers.
      if (header) {
        next_url = header.split(';')[0].replace('<', '').replace('>', '');
      }


      // Iterate over the JSON object
      for (var i = 0, len = tokenList.length; i < len; i++) {
        api_params.tokenList = api_params.tokenList.concat(tokenList[i]); //Keep adding the results to the same array
      }

      if (next_url != '') {
        getTokenJSONList(api_params.setTokenURL(next_url), callback);
      }
      else {
        //Mission Accomplished
        callback();
      }
    });
  }

  //Get info on the provided list of tokens
  function getTokenJSONSummary(onComplete) {
    var token= api_params.tokenList.pop();
    var url = '';
    if (token && token.token) {
      url = api_params.getTokenAnalyticsURL(token.token);
    }
    else {
            //No more tokens left.  Exit.  TODO: Add Error msg to callback if we hit it.
      onComplete();
      return;
    }

    $.getJSON(url, function (resp, txtstatus, jqxhr) {
      var summary = resp;
      var tempList = [];

            // Iterate over the JSON object and force it into the schema that Tableau expects (flat)
      if (summary && summary.timestamps) {
        for (var i = 0, len = summary.timestamps.length; i < len; i++) {
          tempList.push({ 
             'timestamp': summary.timestamps[i],
             'tokenid': token.id,
             'tokenname': token.name,
             'mapviews': summary.services.mapview[i],
             'tileviews': summary.services.tile[i],
             'staticviews': summary.services.static[i],
          });
        }
      }


      _tableData.tokens = _tableData.tokens.concat(tempList);

      if (api_params.tokenList.length > 0) {
        getTokenJSONSummary(onComplete);
      }
      else {
        onComplete();
        return;
      }
    });
  }  

   //Get info on the account
  function getAccountJSONSummary(onComplete) {
    var url = api_params.getAccountAnalyticsURL();

    $.getJSON(url, function (resp, txtstatus, jqxhr) {
      var stylesSummary = resp;
      var tempList = [];

      // Iterate over the JSON object and force it into the schema that Tableau expects (flat)
      if (stylesSummary && stylesSummary.timestamps) {
        for (var i = 0, len = stylesSummary.timestamps.length; i < len; i++) {
          tempList.push({ 
             'timestamp': stylesSummary.timestamps[i],
             'accountname': api_params.username,
             'mapviews': stylesSummary.services.mapview[i],
             'tileviews': stylesSummary.services.tile[i],
             'staticviews': stylesSummary.services.static[i],
             'geocodes': stylesSummary.services.geocode[i],
             'directions': stylesSummary.services.directions[i],
             'mobileusers': stylesSummary.services.mobileactiveusers[i],
          });
        }
      }

      //Stuff the result
      _tableData.accounts = _tableData.accounts.concat(tempList);

      onComplete();
      return;
      
    });
  }
    
    
$(document).ready(function () {
  $('#submitButton').click(function () {
    //Gather up what tables the user wanted
      
    var user_info = {
        username: "",
        token: ""
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
      
    tableau.connectionName = 'Mapbox Analytics';
    tableau.submit();
  });
        
});
    
    
})();



