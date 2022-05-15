// for this project, I kept all code in same file
// in prod, routes, helper functions will be in different files and folders
const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');
const Session = require('koa-session');
const Joi = require('joi');

const fs = require('fs');

const DATA_URL = "./data.json";

const messageSchema = Joi.object({
  from: Joi.string().required(),
  to: Joi.string().required(),
  message: Joi.string().required(),
});
const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

// in prod, credentials shouldn't be stored in a file
// user information and a hashed password will be saved in db
const adminCreds = { username: 'admin', password: 'secret' };
const userCreds = { username: 'user', password: 'secret' };

const app = new Koa();
const router = new Router();

// in prod, session config will depend case by case
const SESSION_CONFIG = {
  key: 'session-key',
  maxAge: 60000,
};

app.keys = ['secret-key'];
app.use(Session(SESSION_CONFIG, app));

// in prod, data will be read from db.
// if there is a requirement to read data from read
// then it will be ideal to use async readFile
// or a stream

const getData = () => {
  try {
    const data = fs.readFileSync(DATA_URL);
    return JSON.parse(data);
  }
  catch (_) {
    throw new Error("ResourceNotFound");
  }
};


// this is naive authentication function
// in prod, authentication will check against hashed passwords in the db
const authenticateUser = ({ username, password }) => {
  if (username === adminCreds.username && password === adminCreds.password) {
    return ({
      authenticated: true,
      userId: "admin"
    });
  }
  if (username === userCreds.username && password === userCreds.password) {
    return ({
      authenticated: true,
      userId: "user"
    });
  }
  else {
    return ({
      authenticated: false
    });
  }
}

const getErrorCode = (err) => {
  console.log(err);
  switch(err.message) {
    case ("ValidationError"):
      return 400
    case ("ResourceNotFound"):
      return 404
    case ("Unauthorized"):
    case ("InvalidUserInfo"):
      return 401
    default:
      return 404
  }
}

router.post('/login', ctx => {
  try {
    const { request : { body : loginCreds } } = ctx;

    const { error } = loginSchema.validate(loginCreds);
    if (error) throw new Error("ValidationError");

    const auth = authenticateUser(loginCreds);
    if (!auth.authenticated) throw new Error("InvalidUserInfo");

    ctx.session.authenticated = true

    // in prod, session id would idealy be a hash 
    // session ids would also be stored in a database like redis
    ctx.session.id = auth.userId;
    ctx.response.status = 200;
  }
  catch(err) {
    ctx.response.status = getErrorCode(err);;
    ctx.response.body = err.message;
  }
});

router.post('/logout', ctx => {
  if (ctx.session.authenticated === true) {
    ctx.session.authenticated = false;
    ctx.session.id = undefined;
  }
  ctx.response.status = 200;
})

router.get('/stats', ctx => {
  try {
    console.log(ctx.session);
    if (!ctx.session?.authenticated || ctx.session.id !== "admin") {
      throw new Error("Unauthorized");
    }
    const data = getData();
    console.log("here sending data", data);
    ctx.body = data;
  } 
  catch(err) {
    ctx.response.status = getErrorCode(err);;
    ctx.response.body = err.message;
  }
});

router.post('/message', ctx => {
  try {
    if (!ctx.session?.authenticated) {
      throw new Error("Unauthorized");
    }

    const { request : { body } } = ctx;

    const { error } = messageSchema.validate(body);
    if (error) throw new Error("ValidationError");

    const { numberOfCalls } = getData();
    const newData = { 
      lastMessage: body, 
      numberOfCalls: numberOfCalls + 1 
    };

    fs.writeFileSync('data.json', JSON.stringify(newData, null, 2));
    ctx.response.status = 200;
  }
  catch (err) {
    ctx.response.status = 404;
    ctx.body = err.message;
  }
});

app
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(3000, () => console.log("listening on port 3000"));
