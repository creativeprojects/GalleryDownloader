const fs = require('fs');
const puppeteer = require('puppeteer');
const commandLineArgs = require('command-line-args');
const url = require("url");
const path = require("path");

const optionDefinitions = [
    {
        name: 'url',
        alias: 'u',
        type: String,
        defaultValue: 'https://example.com/'
    },
    {
        name: 'username',
        alias: 'n',
        type: String,
    },
    {
        name: 'password',
        alias: 'p',
        type: String,
    },
    {
        name: 'output',
        alias: 'o',
        type: String,
        defaultValue: 'images'
    },
    {
        name: 'useragent',
        alias: 'a',
        type: String,
        defaultValue: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.117 Safari/537.36',
    },
    {
        name: 'width',
        alias: 'w',
        type: Number,
        defaultValue: 1650
    },
    {
        name: 'height',
        alias: 'h',
        type: Number,
        defaultValue: 1160
    },
    {
        name: 'timeout',
        alias: 't',
        type: Number,
        defaultValue: 120000
    },
    {
        name: 'wait',
        alias: 'i',
        type: Number,
        defaultValue: 10000
    },
];
const options = commandLineArgs(optionDefinitions);

function getFileName(filePath, fileName) {
    let counter = 1;
    if (fs.existsSync(filePath + '/' + fileName)) {
        const parsedFile = path.parse(fileName);
        // Adds a counter and try again
        while (fs.existsSync(filePath + '/' + parsedFile.name + '-' + counter + parsedFile.ext)) {
            ++counter;
        }
        fileName = parsedFile.name + '-' + counter + parsedFile.ext;
    }
    return filePath + '/' + fileName;
}

function mkDirByPathSync(targetDir, {isRelativeToScript = false} = {}) {
    const sep = path.sep;
    const initDir = path.isAbsolute(targetDir) ? sep : '';
    const baseDir = isRelativeToScript ? __dirname : '.';
  
    targetDir.split(sep).reduce((parentDir, childDir) => {
        const curDir = path.resolve(baseDir, parentDir, childDir);
        try {
            fs.mkdirSync(curDir);
            console.log(`Directory ${curDir} created!`);
        } catch (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
            // console.log(`Directory ${curDir} already exists!`);
        }

        return curDir;
    }, initDir);
}

(async () => {
    // Create output path
    fs.mkdir(options.output, 0777, (err) => {
        if (err) {
            if (err.code !== 'EEXIST') {
                console.error(err);
                exit(1);
            }
        }
    });

    var browser;
    try {
        var puppeteer_options = {
            args: ['--no-sandbox']
        };
        if (options.useragent) {
            puppeteer_options.args.push("--user-agent=" + options.useragent);
        }
        browser = await puppeteer.launch(puppeteer_options);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
    const version = await browser.version();
    console.log('Browser internal version: ' + version);

    const userAgent = await browser.userAgent();
    console.log('User agent set to: ' + userAgent);

    const page = await browser.newPage();
    page.setViewport({ width: options.width, height: options.height });

    if (options.username && options.password) {
        const credentials = {
            username: options.username,
            password: options.password,
        };
        await page.authenticate(credentials);
    }

    page.on('response', async (response) => {
    const matches = /.*\.(jpg|jpeg)$/.exec(response.url());
    if (matches && (matches.length === 2)) {
        const parsedUrl = url.parse(matches[0]);
        const dirName = path.dirname(parsedUrl.pathname);
        const fileName = path.basename(parsedUrl.pathname);
        mkDirByPathSync(options.output + dirName);
        const fullName = getFileName(options.output + dirName, fileName);
    
        console.log(`Saving ${fileName} to ${fullName}.`);
        const buffer = await response.buffer();
        fs.writeFileSync(fullName, buffer, 'base64');
    }
    });

    console.log(`Loading page '${options.url}'...`);
    var gotoOptions = {
        timeout: options.timeout,
        waitUntil: ["networkidle0"]
    };

    try {
        const response = await page.goto(options.url, gotoOptions);
        const chain = response.request().redirectChain();
        console.log('Page returned code ' + response.status() + ' after ' + chain.length + ' redirection(s)');
    } catch (error) {
        console.error(error);
    }
    await page.waitFor(options.wait);
    await browser.close();
})();