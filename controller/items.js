const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const express = require('express');

const formidable = require('formidable');
const path=require('path');
const fs=require('fs');
const Validator= require('validator');
const isEmpty=require('is-empty');

const configUrls=require("../constants/constants");
const validateItemInputs = require("../validation/items");
const { upload } = require('../commons/fileupload');
const db = require("../models");

const uploadFolder = path.join(__dirname,'../' ,"public", "icons");
module.exports = {
    async getCategoryList(req, res, next) {
        let resp = await db.item_categories.findAll({where:{
            parent_category:0,status:1
        }});
        if (resp.length) {
                res.send({
                    status: true,
                    data: resp
                })
        } else {
                res.status(404).send({
                status: false,
                errors: error
            })
        }

    },
    async getCategoryById(req, res, next) {
        const {catId}=req.query;
         try{
        let resp = await db.item_categories.findAll({where:{
            parent_category:catId,status:1
        }});
        if (resp.length) {
                res.send({
                    status: true,
                    data: resp
                })
        } else {
                res.status(404).send({
                status: false,
                errors: error
            })
        }
    }catch(err){
        res.status(500).send({
            status: false,
            errors: `${err}`
        });
    }
    },

    async adNewCategory(req, res, next) {
         if(Validator.isEmpty(req.body.category_name)) {
             res.status(400).json({
                'error_code': 101,
                'status': false,  
                'errors': [{category_name:'Category Name is required!'}]
            });
        }
        try{

        const resp = await db.item_categories.findOne({where:{
            category_name:req.body.category_name
        }});
        if (resp) {
            res.status(400).json({
                'error_code': 101,
                'status': false,  
                'errors': [{category_name:'Category Name already exists!'}]
            })
        }
       
        }catch(err){
            console.log('Error',err);
        }
       
         {
            const result = await db.item_categories.create(req.body);
            if(result){
                res.status(200).json({
                    error: "false",
                    status: "Success",
                    message: 'Item is sucessfully added!',
                    data: result,
            });
            }else
            { res.status(500).json({
                error_code: 109,
                error: true,
                status: "false",
                message: 'Inernal server Error',
                data: result,
        });}
        }
    },
    
    async addNewItem(req, res, next) {
        var form = new formidable.IncomingForm();
        form.parse(req, async function(error, fields, files) {
            const incommingFieldData=JSON.parse(fields.data);
            const { errors, isValid } = validateItemInputs.validateItemInputs(incommingFieldData);
            const type = files.item_image.type.split("/").pop();
            const fileName = encodeURIComponent('icon-'+new Date().getTime())+'.'+type;

        if (!isValid) {
            return res.status(400).json({
                'error_code': 101,
                'status': false,  
                'errors': errors
            });
        } else {
            try {
                if (!files.item_image.length) {
                    const file=files.item_image;
                    const isValid = isFileValid(file);
                    
                        if (!isValid) {
                            // throes error if file isn't valid
                            return res.status(400).json({
                            status: "Fail",
                            message: "The file type is not a valid type",
                            });
                        }
                        try {
                            // renames the file in the directory
                            fs.renameSync(file.path, path.join(uploadFolder, fileName));
                        } catch (error) {
                            console.log(error);
                        }

                        try {
                            // stores the fileName in the database
                            const newFile = await File.create({
                            name: `files/${fileName}`,
                            });
                            
                        } catch (error) {
                            console.log(`File Upload Error ${fileName} `,error);
                        }

                }
                var item = await db.items.findOne({
                    where: {
                        name: incommingFieldData.name,
                        restaurant_id:incommingFieldData.restaurant_id,
                    }
                });
                if (item) {
                    return res.status(409).json({
                        'error_code': 102,
                        'status': false,
                        'errors': 'This item is already added for this restaurant!',
                    })
                }
                const custmizationDetails=incommingFieldData.custmization;
                delete(incommingFieldData['custmization']);
                let result = await db.items.create(incommingFieldData);
                if (result) {
                    let custmizationResponse=[];
                    custmizationDetails.forEach(async element => {
                        console.log('Element',element);
                        const key = Object.keys(element)[0];
                        const custmizeRow={
                            title:key,
                            item_id:result.id,
                            detail:JSON.stringify(element[key])

                        };
                        
                        const custizeResult = await db.item_custmizations.create(custmizeRow);
                       // console.log('custom',custizeResult);
                        custmizationResponse =[...custmizationResponse,custizeResult.dataValues];
                    });
                    //console.log('CustmizationResponse',custmizationResponse);
                    // upload(req, 'icons', 'item_image').then(async (resp) => {
                    //     console.log('test');
                    //     res.status(200).json({
                    //         error: "false",
                    //         status: "Success",
                    //         message: 'Item is sucessfully added1!',
                    //         data: result
                    //     })
                    // });
                    result.custmization=custmizationResponse; 
                    const custmizeRow={
                        image:fileName,
                        item_id:result.id,
                        type:1,
                    };
                    
                        const imageIconResponse = await db.item_images.create(custmizeRow);
                        
                        res.status(200).json({
                        error: "false",
                        status: "Success",
                        message: 'Item is sucessfully added!',
                        data: result,
                        custmizeReponse:custmizationResponse,
                       iconResponse:imageIconResponse,
                       iconUrl:configUrls.configUrls.BASE_URL+'icons/'+fileName,
                    });

                //     /** Commented code for file upload for now */
                     
                } else {
                    return res.status(500).json({
                        'error_code': 109,
                        'status': false,
                        'errors': 'User account not created. Please try again'
                    })
                }
            } catch (error) {
                return res.status(500).json(
                    {
                        error_code: 101,
                        status: false,
                        errors: `${error}`
                    }
                )
            }
        }
        });
    },

    
    async location(req, res, next) {
        if (req.user && req.user.id && req.body.id) {
            db.location.findByPk(req.body.id).then(resp => {
                res.send(resp)
            }).catch(err => {
                res.status(400).send({
                    status: false,
                    errors: err
                })
            })

        }
        else {
            res.sendStatus(406)
        }
    },
    async locationTimings(req, res, next) {
        if (req.body.id) {
            db.location_open.findAll({ where: { location_id: req.body.id } }).then(resp => {
                res.send(resp)
            }).catch(err => {
                res.status(400).send({
                    status: false,
                    errors: err
                })
            })

        }
        else {
            res.sendStatus(406)
        }
    },
}

const isFileValid = (file) => {
    const type = file.type.split("/").pop();
    const validTypes = ["jpg", "jpeg", "png", "pdf"];
    if (validTypes.indexOf(type) === -1) {
      return false;
    }
    return true;
  };