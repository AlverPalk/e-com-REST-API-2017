const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
    title: {type: String, required: true},
    description: {type: String, required: true},
    price: {type: Number, required: true},
    amount: {type: String, required: true},
    category: {type: String, required: true},
    imagePath: {type: String, required: true},
    added: {type: Number, required: true}
});

schema.methods.getPrice = price => {
    return (price / 100).toFixed(2);
};

module.exports = mongoose.model('Product', schema);