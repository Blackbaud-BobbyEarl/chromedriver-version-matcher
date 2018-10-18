const spawn = require('cross-spawn');
const request = require('request');
const chromeFinder = require('chrome-launcher/dist/src/chrome-finder');
const chromeUtils = require('chrome-launcher/dist/src/utils');
const parser = require('xml2js');

function getChromeMajorVersion() {
  const promise = new Promise((resolve, reject) => {
    const platform = chromeUtils.getPlatform();

    const installations = chromeFinder[platform]();

    if (installations && installations.length > 0) {
      const source = spawn(
        installations[0],
        [
          '--version'
        ]
      );
    
      source.stdout.on('data', (data) => {
        const chromeVersion = data.toString().trim().substr('Google Chrome '.length);
        const chromeMajorVersion = +chromeVersion.split('.')[0];
  
        resolve({
          chromeVersion: chromeVersion,
          chromeMajorVersion: chromeMajorVersion
        });
      });
    } else {
      reject('No local installation of Chrome was found.');
    }
  });

  return promise;
}

function getLatestChromeDriverVersion() {
  return new Promise((resolve, reject) => {
    request(
      'https://chromedriver.storage.googleapis.com/', 
      (error, response, body) => {
        if (error) {
          reject(error);
        } else {
          parser.parseString(body, (err, results) => {
            if (err) {
              reject(err);
            } else {
              const versionNumbers = results.ListBucketResult.Contents
                .filter((contents) => {
                  return contents.Key[0].indexOf('/notes.txt') >= 0;
                })
                .map((contents) => {
                  return contents.Key[0].split('/')[0];
                })
                .sort((a, b) => {
                  const aMinorVersion = +a.split('.')[1];
                  const bMinorVersion = +b.split('.')[1];
    
                  if (aMinorVersion < bMinorVersion) {
                    return 1;
                  }
    
                  if (bMinorVersion < aMinorVersion) {
                    return -1;
                  }
    
                  return 0;
                });
                
              resolve(versionNumbers[0]);
            }
          });
        }
      }
    );
  });
}

function getReleaseNotes(latestChromeDriverVersion) {
  return new Promise((resolve, reject) => {
    request(
      'https://chromedriver.storage.googleapis.com/' + 
        latestChromeDriverVersion +
        '/notes.txt',
      (error, response, body) => {
        if (error) {
          reject(error);
        } else {
          resolve(body);
        }
      }
    );
  });
}

function findVersionInReleaseNotes(releaseNotes, chromeMajorVersion) {
  // Look for lines in the release notes that look like this and parse out the mentioned versions:
  // ----------ChromeDriver v2.43 (2018-10-16)----------
  // Supports Chrome v69-71

  const lines = releaseNotes.split('\n');
  
  for (let i = 0, n = lines.length; i < n; i++) {
    const line = lines[i];

    if (line.indexOf('Supports Chrome v') === 0) {
      const supportedMinMax = line.substr('Supports Chrome v'.length).split('-');

      const minVersion = +supportedMinMax[0];
      const maxVersion = +supportedMinMax[1];

      if (chromeMajorVersion >= minVersion && chromeMajorVersion <= maxVersion) {
        const previousLine = lines[i - 1];

        const chromeDriverVersion = previousLine.substr('----------ChromeDriver v'.length).split(' ')[0];

        return chromeDriverVersion;
      }
    }
  }
}

function getChromeDriverVersion() {
  return new Promise((resolve) => {
    Promise.all(
      [
        getChromeMajorVersion(),
        getLatestChromeDriverVersion()  
      ]
    )
      .then((results) => {
        const chromeVersion = results[0];
        const latestChromeDriverVersion = results[1];

        getReleaseNotes(latestChromeDriverVersion)
          .then((releaseNotes) => {
            resolve({
              chromeVersion: chromeVersion.chromeVersion,
              chromeDriverVersion: findVersionInReleaseNotes(
                releaseNotes, 
                chromeVersion.chromeMajorVersion
              )
            });
          });
      });
  });
}

module.exports = {
  getChromeDriverVersion: getChromeDriverVersion
};

// getChromeDriverVersion().then(result => console.log(result));