const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');
const Joi = require('joi');

const fs = require('fs');

const DATA_URL = "./data.json";
const message_schema = Joi.object({
  from: Joi.string().required(),
  to: Joi.string().required(),
  message: Joi.string().required(),
})

const adminCreds = { name: 'admin', pass: 'secret' };
const userCreds = { name: 'user', pass: 'secret' };

const app = new Koa();
const router = new Router();

// if there is a requirement to read data from read
// then in prod, it will be ideal to use async readFile
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

router.get('/stats', async (ctx, next) => {
    try {
      const data = getData();
      console.log("here sending data", data);
      ctx.body = data;
    } 
    catch(err) {
      console.log(err);
      ctx.response.status = 404;
      ctx.body = err.message;
    }
});

router.post('/message', (ctx, next) => {
  try {
    const { request : { body } } = ctx;

    const { error } = message_schema.validate(body);
    if (error) {
      throw new Error("ValidationError");
    }

    const { numberOfCalls } = getData();
    const newData = { 
      lastMessage: body, 
      numberOfCalls: numberOfCalls + 1 
    };

    fs.writeFileSync('data.json', JSON.stringify(newData, null, 2));
    ctx.response.status = 200;
  }
  catch (err) {
    console.log(err);
    switch(err.message) {
      case ("ValidationError"):
        ctx.response.status = 400;
        ctx.body = err.message;
      case ("ResourceNotFound"):
        ctx.response.status = 404;
        ctx.body = err.message;
      default:
        ctx.response.status = 404;
        ctx.body = err.message;
    }
  }
});

app
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(3000);


