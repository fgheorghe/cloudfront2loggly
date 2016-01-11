var zlib = require('zlib'),
    csv = require('fast-csv'),
    request = require('request'),
    aws = require('aws-sdk'),
    s3 = new aws.S3({apiVersion: '2006-03-01'}),
    // Function used for transforming data before pushing it to longly. Remove if no transformation needed.
    transformer = function(data) {
	// Convert some fields to integer.
	data["time-taken"] = parseInt(data["time-taken"], 10);
	data["cs-bytes"] = parseInt(data["cs-bytes"], 10);
	data["sc-bytes"] = parseInt(data["sc-bytes"], 10);

	return data;
    },
    // CSV parsing configuration, as per: https://github.com/C2FO/fast-csv
    csvParserConfig = {
        comment: "#",
        delimiter: '\t',
        headers: [
            'date',
            'time',
            'x-edge-location',
            'sc-bytes',
            'c-ip',
            'cs-method',
            'cs(Host)',
            'cs-uri-stem',
            'sc-status',
            'cs(Referer)',
            'cs(User-Agent)',
            'cs-uri-query',
            'cs(Cookie)',
            'x-edge-result-type',
            'x-edge-request-id',
            'x-host-header',
            'cs-protocol',
            'cs-bytes',
            'time-taken',
            'x-forwarded-for',
            'ssl-protocol',
            'ssl-cipher',
            'x-edge-response-result-type'
        ]
    },
    // Loggly credentials and tag name.
    // Replace TAG_NAME with a tag of your choice, and ACCESS_TOKEN with your loggly token.
    logglyConfig = {
        tag: "TAG_NAME",
        token: "ACCESS_TOKEN"
    };

/**
 * Extract file contents.
 * @param buffer
 * @param callback
 * @returns {*} Buffer data - archive contents.
 */
function gunzip(buffer, callback) {
    zlib.gunzip(buffer, callback);
}

/**
 * Parse a CSV string - the content of the gunzipped CSV file.
 * @param content
 * @param options
 * @param dataCallback
 * @param endCallback
 */
function parseCsv(content, options, dataCallback, endCallback) {
   csv
        .fromString(content, options)
        .on("data", dataCallback)
        .on("end", endCallback);
}

/**
 * Handle Lambda specific events.
 *
 * @param event
 * @param context
 */
exports.handler = function(event, context) {
    try {
        // Get file details.
        var s3Data = event.Records[0].s3,
            filename = s3Data.object.key,
            bucketName = s3Data.bucket.name,
            size = s3Data.object.size,
            fileContent = "";

        // Check if data is valid.
        if (typeof filename === "undefined") {
            console.log("[-] No file data.");
        } else {
            // Begin processing file related event.
            console.log("[+] Filename: " + filename);
            console.log("[+] Bucket name: " + bucketName);
            console.log("[+] Size: " + size);

            // Ignore empty files.
            if (size === 0) {
                console.log("[-] Ignoring file of size 0.");
            } else {
                // Download file from s3 bucket.
                try {
                    s3
                        .getObject({
                            Bucket: bucketName,
                            Key: filename
                        }, function(error, data) {
                            if (error) {
                                console.log("[-] Unable to download file: ");
                                console.log(error);
                            } else {
                                console.log("[+] File downloaded...");
                                try {
                                    // Try to extract data.
                                    gunzip(data.Body, function (error, data) {
                                        if (error) {
                                            console.log("[-] Unable to gunzip file: ");
                                            console.log(error);
                                        } else {
                                            // Parse CSV file.
                                            parseCsv(
                                                data,
                                                csvParserConfig,
                                                function(data) {
                                                    // Push to loggly.
                                                    try {
							   if (typeof transformer !== "undefined") {
								data = transformer(data);
							   }
                                                        request.post({
                                                            url: "http://logs-01.loggly.com/inputs/" + logglyConfig.token + "/tag/" + logglyConfig.tag,
                                                            headers: {
                                                                "content-type": "application/x-www-form-urlencoded"
                                                            },
                                                            form: data
                                                        }, function(error) {
                                                            if (error) {
                                                                console.log("[-] Unable to post log record:");
                                                                console.log(error);
                                                            }
                                                        });
                                                    } catch (ex) {
                                                        console.log("[-] Unable to post logs:");
                                                        console.log(ex);
                                                    }
                                                },
                                                function() {
                                                    console.log("[+] Done parsing and pushing file.");
                                                }
                                            );
                                        }
                                    });
                                } catch (ex) {
                                    console.log("[-] Unable to gunzip file: ");
                                    console.log(ex);
                                }
                            }
                        });
                } catch (ex) {
                    console.log("[-] Unable to download file: ");
                    console.log(ex);
                }
            }
        }
    } catch (ex) {
        console.log("[-] Unable to read event data: ");
        console.log(ex);
    }
};
