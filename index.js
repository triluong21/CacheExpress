const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const PORT = process.env.PORT || 3000;
const app = express();
const path = require("path");
const mCache = require('memory-cache');
const flatCache = require('flat-cache');
const Memcached = require('memcached');
const redis = require('redis');
const client = redis.createClient();

// Configure In-Memory Cache
let memCache = new mCache.Cache();

let cacheMiddleware = duration => {
  return (req, res, next) => {
    let key = "__express__" + req.originalUrl || req.url;
    let cacheContent = memCache.get(key);
    if (cacheContent) {
      res.send(cacheContent);
      console.log('reading from cache');
    } else {
      res.sendResponse = res.send;
      res.send = body => {
        memCache.put(key, body, duration * 1000);
        res.sendResponse(body);
      };
      console.log('storing in cache');
      next();
    }
  };
};

// Configure Flat Cache
let cache = flatCache.load("productsCache", path.resolve("./cache"));

let flatCacheMiddleware = (req, res, next) => {
  let key = "__express__" + req.originalUrl || req.url;
  let cacheContent = cache.getKey(key);
  if (cacheContent) {
    res.send( cacheContent );
    return;
  } else {
    res.sendResponse = res.send;
    res.send = body => {
      cache.setKey(key, body);
      cache.save();
      res.sendResponse(body);
    };
    next();
  }
};

// Configure the MemCached Service
let memcached = new Memcached("127.0.0.1:11211")

    let memcachedMiddleware = (duration) => {
        return  (req,res,next) => {
        let key = "__express__" + req.originalUrl || req.url;
        memcached.get(key, function(err,data){
            if(data){
                res.send(data);
                return;
            }else{
                res.sendResponse = res.send;
                res.send = (body) => {
                    memcached.set(key, body, (duration*60), function(err){
                        // 
                    });
                    res.sendResponse(body);
                }
                next();
            }
        });
    }
    };

// create redis middleware
let redisMiddleware = (req, res, next) => {
  let key = "__expIress__" + req.originalUrl || req.url;
  console.log("key: ", key);
  client.get(key, function(err, reply){
    if(reply){
        res.send(reply);
    }else{
        res.sendResponse = res.send;
        res.send = (body) => {
            client.set(key, JSON.stringify(body));
            res.sendResponse(body);
        }
        next();
    }
  });
};

// App Route
// app.get('/products', cacheMiddleware(30), function(req, res) {
// app.get('/products', flatCacheMiddleware, function(req, res) {
// app.get('/products', memcachedMiddleware(20), function(req, res) {
app.get('/products', redisMiddleware, function(req, res) {
  setTimeout(() => {
    let db = new sqlite3.Database('./NodeInventory.db');
    let sql = 'SELECT * FROM PRODUCTS';

    db.all(sql, [], (error, rows) => {
      if (error) {
        throw error;
      }
      db.close();
      res.send(rows);
    });
  }, 3000);
});

// App Port
app.listen(PORT, function() {
  console.log(`App running on port ${PORT}`);
});