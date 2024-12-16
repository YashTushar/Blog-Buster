const mongoose = require('mongoose');
const { Type } = require('selenium-webdriver/lib/logging');

const postSchema = mongoose.Schema({
    user:{type:mongoose.Schema.Types.ObjectId, ref:"user"},
    username:{type:String, ref:"user"},
    date: {
        type:Date,
        default:Date.now
    },
   
    content:String,
    edited:{
        type:Boolean,
        default:false
    },
    likes:[{
        type:mongoose.Schema.Types.ObjectId, ref:"user"
    }],
    size:{
        type:Number,
        default:0
    }
});

postSchema.index({content: 'text'});

module.exports = mongoose.model('post',postSchema);