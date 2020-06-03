const express = require('express');
const csrf = require('csurf');
const router = express.Router();
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const convert = require('xml-js');
const axios = require('axios');
const validator = require('validator');
const MKSDK = require('makecommerce-sdk');
const Cart = require('../models/cart');
const config = require('../config/config');

const Product = require('../models/product');
const Order = require('../models/order');

const MKAPI = new MKSDK(config.shop_id, config.public_key, config.secret_key, true);

const csrfProtection = csrf();

const variables = {
    email: config.email,
    phone: config.phone,
    address: config.address,
};

router.use((err, req, res, next) => {
    if (err.code !== 'EBADCSRFTOKEN') return next(err);
    res.status(404).send('form tampered with');
});

// Home page
router.get('/', csrfProtection, (req, res) => {
    let errors = req.flash('error');
    let success = req.flash('success');

    Product.find().then(products => {
        res.render('index', {
            pageTitle: config.pageTitle,
            csrfToken: req.csrfToken(),
            pageAddress: config.pageAddress,
            currentYear: new Date().getFullYear(),
            phone: variables.phone,
            email: variables.email,
            address: variables.address,
            products,
            hasErrors: errors.length > 0,
            error: errors,
            hasSuccess: success.length > 0,
            success: success,
            cartCount: req.session.cart !== undefined ? req.session.cart.totalQty : 0
        });
    });
});

// Sending the email
router.post('/send-email', (req, res) => {
    let email = req.body.email;
    let hasErrors = false;

    if (!validator.isEmail(validator.normalizeEmail(validator.escape(email)))) {
        req.flash('error', 'Vigane email');
        hasErrors = true;
    }

    if (!hasErrors) {
        const from = req.body.email;
        const to = variables.email;
        const subject = `Email <${req.body.email}> | ${config.address}`;
        const html = ''; // Content hidden
        sendEmail(from, to, subject, html);
        req.flash('success', 'E-mail saadetud!');
    }

    res.redirect('/');

});

// Smartpost
router.get('/smartpost', (req, res) => {
    axios.get(config.smartpost).then(response => {
        res.send(convert.xml2json(response.data, {compact: true, spaces: 4}))
    })
});

// Add to cart
router.post('/add-to-cart/:id', (req, res) => {
    let productId = validator.escape(req.params.id);
    let qty = parseInt(req.body.qty);

    if (typeof qty !== 'number' || qty < 1) {
        req.flash('error', 'Vigane kogus');
        return res.redirect('/checkout');
    }

    let cart = new Cart(req.session.cart ? req.session.cart : {});

    Product.findById(productId, (err, product) => {
        if (err) {
            return res.redirect('/');
        }
        cart.add(product, productId, qty);
        req.session.cart = cart;

        if (qty > 1) {
            req.flash('success', `${qty} toodet lisati ostukorvi!`);
        } else {
            req.flash('success', `${qty} toode lisati ostukorvi!`);
        }
        res.redirect('/');
    });
});

// Checkout
router.get('/checkout', csrfProtection, (req, res) => {
    if (!req.session.cart || req.session.cart.totalQty === 0) {
        req.flash('error', 'Ostukorvis puuduvad tooted!');
        return res.redirect('/');
    }

    let errors = req.flash('error');
    let success = req.flash('success');

    let cart = new Cart(req.session.cart);
    res.render('checkout', {
        pageTitle: 'Vormista tellimus',
        csrfToken: req.csrfToken(),
        products: cart.generateArray(),
        totalPrice: cart.totalPrice,
        hasErrors: errors.length > 0,
        error: errors,
        hasSuccess: success.length > 0,
        success: success
    })
});

// Remove from cart
router.get('/remove-item/:id', (req, res) => {
    let id = validator.escape(req.params.id);
    let cart = new Cart(req.session.cart ? req.session.cart : {});
    cart.remove(id);

    if (req.session.cart.items === {} || req.session.cart.totalQty === 0) {
        req.session.cart = {};
    } else {
        req.session.cart = cart;
    }

    if (req.session.cart || req.session.cart.totalQty === 0) {
        req.flash('success', 'Edukalt eemaldatud!');
        res.redirect('/checkout');
    } else {
        req.flash('error', 'Ostukorvis puuduvad tooted!');
        res.redirect('/');
    }
});

// Change qty
router.post('/change-qty/:id', (req, res) => {
    let productId = validator.escape(req.params.id);
    let qty = parseInt(req.body.qty);
    let cart = new Cart(req.session.cart ? req.session.cart : {});

    if (typeof qty !== 'number' || qty < 1) res.redirect('/checkout');

    Product.findById(productId, (err, product) => {
        if (err) res.redirect('/checkout');

        cart.change(productId, qty);
        req.session.cart = cart;
        req.flash('success', `Kogus muudetud!`);
        res.redirect('/checkout');
    });
});

// Order
router.post('/order', (req, res) => {
    if (req.body.terms === 'true') {
        if ((req.body.eesnimi !== undefined) && (req.body.perekonnanimi !== undefined) && (req.body.email !== undefined) && (req.body.sihtkoht !== undefined) && (req.body.sihtkoht !== 'vali') && (req.body.tel !== undefined)) {
            const eesnimi = validator.escape(req.body.eesnimi);
            const perekonnanimi = validator.escape(req.body.perekonnanimi);
            const email = validator.escape(req.body.email);
            const tel = validator.escape(req.body.tel);
            const sihtkoht = validator.escape(req.body.sihtkoht);

            if (validator.isEmail(email)) {
                const reference = generateRandomId();

                new Order({
                    reference: reference,
                    cart: JSON.stringify(req.session.cart),
                    status: 'PENDING',
                    firstName: eesnimi,
                    lastName: perekonnanimi,
                    email: email,
                    tel: tel,
                    destination: sihtkoht,
                    price: req.session.cart.totalPrice.toString()
                }).save().then(response => {

                    MKAPI.createTransaction({
                        transaction: {
                            amount: ((req.session.cart.totalPrice + 350) / 100).toFixed(2),
                            currency: 'EUR',
                            reference: reference,
                        },

                        customer: {
                            email: email,
                            ip: req.connection.remoteAddress,
                            country: 'EE',
                            locale: 'et'
                        }
                    }).then((transaction) => {
                        console.log(`Transaction [${transaction.id}] created`);
                        res.redirect(transaction.payment_methods.other[0].url);
                    }).catch((err) => {
                        req.flash('error', 'Tekkis tõrge!');
                        res.redirect('/');
                    });
                }).catch(err => {
                    req.flash('error', 'Tekkis tõrge!');
                    res.redirect('/');
                });
            } else {
                req.flash('error', 'Mittesobiv email!');
                res.redirect('/checkout');
            }

        } else {
            req.flash('error', 'Kõik väljad peavad olema täidetud!');
            res.redirect('/checkout');
        }
    } else {
        req.flash('error', 'Te ei nõustunud kasutustingimustega!');
        res.redirect('/checkout');
    }
});

// Notifications
router.post('/order-notifications', (req, res) => {
    const body = JSON.parse(req.body.json);
    const reference = body.reference;
    const status = body.status;

    switch (status) {
        case 'PENDING':
            Order.findOneAndUpdate({reference: reference}, {status: 'PENDING'}).catch(err => console.log('Reference error'));
            break;
        case 'CANCELLED':
            Order.findOneAndUpdate({reference: reference}, {status: 'CANCELLED'}).catch(err => console.log('Reference error'));
            break;
        case 'EXPIRED':
            Order.findOneAndUpdate({reference: reference}, {status: 'EXPIRED'}).catch(err => console.log('Reference error'));
            break;
        case 'COMPLETED':
            Order.findOneAndUpdate({reference: reference}, {status: 'COMPLETED'}).catch(err => console.log('Reference error'));


            Order.findOne({reference: reference}).then(data => {

                // Send order data to store
                let from = config.orderEmail;
                let to = variables.email;
                let subject = `Tellimus ${reference} | ${config.address}`;
                let html = ''; // Content hidden

                let parsedData = JSON.parse(data.cart).items;

                Object.keys(parsedData).forEach(key => {
                    let value = `<li><strong>${parsedData[key].qty}x</strong> ${parsedData[key].item.title} (${(parsedData[key].price / 100).toFixed(2)}€)</li>`;
                    html += value;
                });

                html += `
                            </ul>
                        <p>Sihtkoht: ${data.destination}</p>
                        </footer>
                    </div>
                `;

                sendEmail(from, to, subject, html);

                // Send order data to customer
                to = data.email;
                html = ''; // Content hidden

                Object.keys(parsedData).forEach(key => {
                    let value = `<li><strong>${parsedData[key].qty}x</strong> ${parsedData[key].item.title} (${(parsedData[key].price / 100).toFixed(2)}€)</li>`;
                    html += value;
                });

                html += `
                                </ul>
                        <p>Sihtkoht: ${data.destination}</p>
                        </footer>
                    </div>
                `;
            });
            break;
    }
    res.redirect('/');
});

// Successful purchase
router.post('/successful-purchase', (req, res) => {
    req.flash('success', 'Ost sooritatud!');
    req.session.cart = undefined;
    res.redirect('/');
});

// Privaatsuspoliitika
router.get('/privaatsuspoliitika', (req, res) => {
    res.render('privaatsuspoliitika', {pageTitle: 'Isikuandmete kaitse tingimused'})
});

const generateRandomId = () => {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < 16; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
};

const sendEmail = (from, to, subject, html) => {
    const transporter = nodemailer.createTransport(
        sendgridTransport({
            auth: {
                api_key:
                    config.sendgrid_key,
            }
        })
    );

    const mailOptions = {
        from,
        to,
        subject,
        html
    };

    transporter.sendMail(mailOptions, err => {
        if (err) console.log('Error with sending the email');
    });
};

module.exports = router;
