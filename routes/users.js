var express = require('express');
var router = express.Router();
//var { auth } = require('./middleware')


/*====Controller Listing============*/

var user = require("../controller/user");
//var prof = require('../controller/professional');
//var family = require('../controller/family');

/*=======Routes============ */
router.post('/signup', user.userRegistration);
//router.post('/signin', user.login);
//router.get('/user-info', auth, user.userInfo);
router.post('/generatePin',  user.sendRegistrationPin);
router.post('/validatePin', user.validatePin);
router.post('/uploadRestauratWelcomeAsset',user.uploadRestauratWelcomeAsset);


module.exports = router;
