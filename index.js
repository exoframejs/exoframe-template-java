// npm packages
const fs = require('fs');
const path = require('path');

const javaDockerfile = () =>
  `FROM openjdk
COPY . /usr/src/myapp
WORKDIR /usr/src/myapp
EXPOSE 80
CMD java -jar app.jar`;

// template name
exports.name = 'java';

// function to check if the template fits this recipe
exports.checkTemplate = async ({tempDockerDir}) => {
  // if project already has dockerfile - just exit
  try {
    const filesList = fs.readdirSync(tempDockerDir);
    return filesList.filter(file => file.includes('.jar')).length > 0;
  } catch (e) {
    return false;
  }
};

// function to execute current template
exports.executeTemplate = async ({username, tempDockerDir, resultStream, util, existing, docker}) => {
  try {
    // generate dockerfile
    const dockerfile = javaDockerfile();
    const dfPath = path.join(tempDockerDir, 'Dockerfile');
    fs.writeFileSync(dfPath, dockerfile, 'utf-8');
    util.writeStatus(resultStream, {message: 'Deploying Java project..', level: 'info'});

    // build docker image
    const buildRes = await docker.build({username, resultStream});
    util.logger.debug('Build result:', buildRes);

    // check for errors in build log
    if (
      buildRes.log
        .map(it => it.toLowerCase())
        .some(it => it.includes('error') || (it.includes('failed') && !it.includes('optional')))
    ) {
      util.logger.debug('Build log conains error!');
      util.writeStatus(resultStream, {message: 'Build log contains errors!', level: 'error'});
      resultStream.end('');
      return;
    }

    const container = await docker.start(Object.assign({}, buildRes, {username, existing, resultStream}));
    util.logger.debug(container);

    // clean temp folder
    await util.cleanTemp();

    // return new deployments
    util.writeStatus(resultStream, {message: 'Deployment success!', deployments: [container], level: 'info'});
    resultStream.end('');
  } catch (e) {
    util.logger.debug('build failed!', e);
    util.writeStatus(resultStream, {message: e.error, error: e.error, log: e.log, level: 'error'});
    resultStream.end('');
  }
};
