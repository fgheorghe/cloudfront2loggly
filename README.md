# cloudfront2loggly

NodeJS AWS Lambda script for pushing gzipped Cloud Front log files stored in Amazon S3 to Loggly as JSON objects.

# How to use

* Clone the repository and install dependencies:

```
npm install
```

* Configure Loggly by editing cloudfront2loggly.js and changing:
 
```
logglyConfig = {
    tag: "TAG_NAME",
    token: "ACCESS_TOKEN"
};
```

* Compress the code and upload to AWS Lambda:

```
zip -r cloudfront2loggly cloudfront2loggly.js node_modules
```

# Further reading

For more details about AWS Lambda and Loggly, please read:

* http://aws.amazon.com/lambda/
* https://www.loggly.com/

# Developer notes

To alter log data, before pushing to Loggly, change the data object at these lines:

```
// To alter data (i.e. remove sensitive log content), alter the data object before issuing request.post.
function(data) {
    [...]
}
```

