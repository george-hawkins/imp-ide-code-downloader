'use strict';

var http = require('http');
var readline = require('readline');
var fs = require('fs');

var TOKEN_FILE = 'imp-token.txt';

var rl = readline.createInterface(process.stdin, process.stdout);

// Try and read existing token.
fs.readFile(TOKEN_FILE, function read(err, content) {
    if (err) {
        getLoginDetails();
    } else {
        verifyToken(content);
    }
});

function verifyToken(token) {
    ideRequest(token, 'session', function (err, res, body) {
        if (err) {
            fatal(err);
        }

        if (res.statusCode != 200) {
            info('the saved imp token appears to be no longer valid');
            fs.unlink(TOKEN_FILE);
            getLoginDetails();
        } else {
            info('connected as ' + body.username);
            getModels(token);
        }
    });
}

function getLoginDetails() {
    console.log('Enter your Imp IDE email address and password');

    rl.question('Email: ', function (email) {
        rl.question('Password: ', function (password) {
            login({
                email: email,
                password: password
            });
        });
    });
}

function login(details) {
    var headers = {
        'Content-Type': 'application/json',
    };
    httpRequest('POST', '/account/login', headers, function (err, res, body) {
        if (err) {
            fatal(err);
        }

        if (body.token) {
            var token = body.token.match(/imp.token=(.*)/)[1];

            saveToken(token);
        } else {
            fatal(body);
        }
    }, details);
}

function saveToken(token) {
    rl.question('Save token to skip login step next time? [y] ', function (answer) {
        if (!answer || answer.toLowerCase() == 'y') {
            fs.writeFile(TOKEN_FILE, token, function (err) {
                if (err) {
                    fatal(err);
                }
                info('saved token');
                getModels(token);
            });
        } else {
            getModels(token);
        }
    });
}

function getModels(token) {
    ideRequest(token, 'models', function (err, res, models) {
        if (err) {
            fatal(err);
        }

        console.log('Models:');
        for (var i = 0; i < models.length; i++) {
            console.log('\t' + models[i].name)
        }

        rl.question('Enter model name: ', function (name) {
            var model = findModel(models, name);

            getCode(token, model);
        });
    });
}

function getCode(token, model) {
    var path = 'models/' + model.id + '/code';

    ideRequest(token, path, function (err, res, code) {
        if (err) {
            fatal(err);
        }

        save(model.name, code, 'agent');
        save(model.name, code, 'imp');
        rl.close();
    });
}

function save(modelName, code, side) {
    var sideName = (side == 'agent' ? 'agent' : 'device');

    if (code[side].code) {
        var fileName = sideName + '.nut';

        fs.writeFile(fileName, code[side].code, function (err) {
            if (err) {
                fatal(err);
            }
            info('saved ' + fileName);
        });
    } else {
        info('"' + modelName + '" has no ' + sideName + ' code');
    }
}

function findModel(models, name) {
    for (var i = 0; i < models.length; i++) {
        if (models[i].name == name) {
            return models[i];
        }
    }

    fatal('no model has the name "' + name + '"');
}

function ideRequest(token, path, callback) {
    var headers = {
        'Cookie': 'imp.token=' + token
    };

    httpRequest('GET', '/ide/v3/' + path, headers, callback);
}

function httpRequest(method, path, headers, callback, content) {
    var options = {
        method: method,
        host: 'api.electricimp.com',
        port: 80,
        path: path,
        headers: headers
    };

    var req = http.request(options, function (res) {
        var body = '';
        res
            .on('data', function(chunk) {
                body += chunk;
            })
            .on('end', function() {
                body = body ? JSON.parse(body) : null;
                callback(null, res, body);
            });
    }).on('error', function(e) {
        callback(e);
    });

    if (content) {
        req.end(JSON.stringify(content));
    } else {
        req.end();
    }
}

function info(message) {
    console.log('Info:', message);
}

function fatal(message) {
    console.log('Error:', message);
    process.exit(1);
}
