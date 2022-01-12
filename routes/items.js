var express = require('express');
var router = express.Router();
var { auth } = require('./middleware')


/*====Controller Listing============*/

var items = require("../controller/items");

/*=======Routes============ */
router.get('/getCategoryList', items.getCategoryList);
router.get('/getCategoryById', items.getCategoryById);
router.post('/addNewItem', items.addNewItem);
router.post('/locationTimings', auth, items.locationTimings);
router.post('/adNewCategory',items.adNewCategory)


module.exports = router;
