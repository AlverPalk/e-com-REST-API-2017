class Cart {
    constructor(oldCart) {
        this.items = oldCart.items || {};
        this.totalQty = oldCart.totalQty || 0;
        this.totalPrice = oldCart.totalPrice || 0;
    }

    add(item, id, qty) {
        if (qty < 1) {
            qty = 1;
        }
        let storedItem = this.items[id];
        if (!storedItem) {
            storedItem = this.items[id] = {item, qty: 0, price: 0}
        }
        storedItem.qty += qty;
        storedItem.price = storedItem.item.price * storedItem.qty;
        this.totalQty += qty;
        this.totalPrice += storedItem.price;
    };

    remove(id) {
        let deleted = false;
        for (let i in this.items) {
            if (this.items[i].item._id === id) {
                this.totalPrice -= this.items[i].price;
                this.totalQty -= this.items[i].qty;
                delete this.items[i];
            }
        }
        return deleted;
    }

    change(id, qty) {
        for (let i in this.items) {
            if (this.items[i].item._id === id) {
                this.totalQty -= this.items[i].qty;
                this.totalPrice -= this.items[i].price;

                this.items[i].qty = qty;
                this.items[i].price = qty * this.items[i].item.price;

                this.totalPrice += this.items[i].price;
                this.totalQty += this.items[i].qty;
            }
        }
    }

    generateArray() {
        let arr = [];
        for (let id in this.items) {
            arr.push(this.items[id]);
        }
        return arr;
    }
}

module.exports = Cart;