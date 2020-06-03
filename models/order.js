const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
    reference: {type: String, required: true},
    cart: {type: String, required: true},
    status: {type: String, required: true},
    firstName: {type: String, required: true},
    lastName: {type: String, required: true},
    email: {type: String, required: true},
    tel: {type: String, required: true},
    destination: {type: String, required: true},
    price: {type: String, required: true},
});

module.exports = mongoose.model('Order', schema);