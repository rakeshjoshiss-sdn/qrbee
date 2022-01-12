const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const db = require("../models");
const express = require('express');

const redis = require('ioredis');
const client =  redis.createClient('6379','127.0.0.1');
const Validator= require('validator');
const isEmpty=require('is-empty');
const formidable = require('formidable');
const fs=require('fs');
const path=require('path');

const userMessages=require("../constants/constants");
const validateRegisterInput = require("../validation/register");
const validateLoginInput = require("../validation/login");
const pinValidation = require("../validation/pinValidation");
const { sendEmail } = require('../commons/helper');
const verifyPassword = require("../validation/resetpassword");
const userInfoValidation = require("../validation/user-info");
const { upload } = require('../commons/fileupload');
const user = require('../models/user');

const uploadFolder = path.join(__dirname,'../' ,"public", "welcome-assets");



client.on('connect',() => {
    console.log('connected to redis successfully!');
})


async function sendRegistrationPin(req,res,next){
    const errors={};
    if(isEmpty(req.body.email)){
        errors.email="Email/Phone field is required";
    }
    if(Object.entries(errors).length !== 0){
        res.status(400).json({
            error:true,
            message:errors,
        });
    }
    const pin=Math.floor(1000 + Math.random() * 9000);
     await client.set(req.body.email.toString(), pin.toString(),'ex',300);
    if(!Validator.isEmail(req.body.email)){
        const accountSid = userMessages.twilloParams.ACCOUNT_SID; 
        const authToken = userMessages.twilloParams.AUTH_TOKEN; 
        const client = require('twilio')(accountSid, authToken); 
        
        client.messages 
            .create({ 
                body: userMessages.messages.otp_phone.replace('___otp___',pin),  
                messagingServiceSid: userMessages.twilloParams.SERVICE_SID,      
                to: req.body.email.toString() 
            }) 
            .then(message => {console.log(message.sid);
                res.status(200).json({
                    error:false,
                    message:userMessages.messages.success_pin,
                });
            }
            
            ) 
            .done();
    }else{
       
   
    const mailRes= await sendEmail(req.body.email.toString(),userMessages.messages.otp_mail_subject,userMessages.messages.otp_email.replace('___otp___',pin))
   
    if(mailRes.accepted){
        res.status(200).json({
            error:false,
            message:userMessages.messages.success_pin,
        });
    }else{
        res.status(500).json({
            error:false,
            message:userMessages.messages.error_pin,
        });
    }
    }
}

async function validatePin(req,res,next){
    const errors={};
    if(isEmpty(req.body.email)){
        errors.email="Email field is required";
    }else if(isEmpty(req.body.pin)){
        errors.pin="Pin field is reuired"; 
    }else if(!Validator.isEmail(req.body.email)){
        errors.email="Email is not valid";
    }
    if(Object.entries(errors).length !== 0){
        res.status(400).json({
            error:true,
            message:errors,
        });
    }
    const pin=await client.get(req.body.email.toString());
    if(pin===req.body.pin){
        await client.del(req.body.email.toString());
        var user = await db.user.findOne({
            where: {
                email: req.body.email
            }
        });
        if(user){
            res.status(200).json({
                error:false,
                message:userMessages.messages.otp_validate,
                data:user,
            });
        }else{
        
        res.status(200).json({
            error:false,
            message:userMessages.messages.otp_validate,
        });
        }
    }else{
        res.status(400).json({
            error:false,
            message:userMessages.messages.incorrect_otp,
        });
    }
}

// const User = require("../models/Users");
async function userRegistration(req, res, next) {
    
    const { errors, isValid } = validateRegisterInput.validateRegisterInput(req.body);
    if (!isValid) {
        return res.status(400).json({
            'error_code': 101,
            'status': false,  
            'errors': errors
        });
    } else {
        try {
            var user = await db.user.findOne({
                where: {
                    email: req.body.email
                }
            });
            if (user) {
                return res.status(409).json({
                    'error_code': 102,
                    'status': false,
                    'errors': 'Email id already configured',
                })
            }
            var user = await db.user.findOne({
                where: {
                    phone_number: req.body.phone_number
                }
            });
            // if (user) {
            //     return res.status(409).json({
            //         'error_code': 103,
            //         'status': false,
            //         'errors': 'Phone number already configured'
            //     })
            // }
            req.body.status = 0;     //For testing purpose
            var result = await db.user.create(req.body);
            if (result) {
                res.status(200).json({
                    error: "false",
                    status: "Success",
                    message: 'User account is successfully created!',
                    data: result
                })
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
}


async function uploadRestauratWelcomeAsset(req,res,next){
    const form = new formidable.IncomingForm();
    form.parse(req, async function(error, fields, files) {
        const incommingFieldData=fields;
        if(Validator.isEmpty(incommingFieldData.user_id)) {
        return res.status(400).json({
            'error_code': 101,
            'status': false,  
            'errors': [{user_id:'User Id is required!'}]
        });
        }else if(!Object.keys(files).length){
            return res.status(400).json({
                'error_code': 101,
                'status': false,  
                'errors': [{welcome_asset:'Welcome asset is required'}]
            });
        }
  
        const type = files.welcome_asset.type.split("/").pop();
        const fileName = encodeURIComponent('welcome_asset-'+new Date().getTime())+'.'+type;

    // if (!isValid) {
    //     return res.status(400).json({
    //         'error_code': 101,
    //         'status': false,  
    //         'errors': errors
    //     });
    // } else {
        try {
            if (!files.welcome_asset.length) {
                const file=files.welcome_asset;
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
            try{
            const result = await db.user.update({welcome_asset:`${fileName}`},{
                where: {
                    id: parseInt(incommingFieldData.user_id),
                },
                returning: true,
                plain: true
            });
            
            
            console.log('user id', incommingFieldData.user_id);
            console.log('result',result);
            if (result) {
                return res.status(200).json({
                    'error': false,
                    'status': true,
                    'errors': 'Record is successfully updated!',
                })
            }
        }catch(err){
            console.log('Error',err);
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
    
    });
}

const isFileValid = (file) => {
    const type = file.type.split("/").pop();
    const validTypes = ["jpg", "jpeg", "png", "pdf"];
    if (validTypes.indexOf(type) === -1) {
      return false;
    }
    return true;
  };



module.exports = { userRegistration,validatePin,sendRegistrationPin,uploadRestauratWelcomeAsset }
