export class Number {
    constructor(value) {
        this.value = +value;
    }

    sort() {

    }

    toHTML() {
        return String(this.value);
    }
}

export class Variable {
    constructor(name) {
        this.name = name;
    }

    sort() {

    }

    toHTML() {
        return String(this.name);
    }
}

export class Function {
    constructor(name, left, right) {
        this.name = name;
        this.left = left;
        this.right = right;
    }

    sort() {

    }

    toHTML() {
        return String(this.name) + "(" + this.left.toHTML() + ")";
    }
}

export class BinaryOperator {
    constructor(op, left, right) {
        this.op = op;
        this.left = left;
        this.right = right;
    }

    sort() {
        //sort the left and right hand side so literals prefer being on the left
        if (this.op === '*' && !(this.left instanceof Number) && this.right instanceof Number) {
            const temp = this.left;
            this.left = this.right;
            this.right = temp;
        }

        this.left.sort();
        this.right.sort();
    }

    precedence() {
        var precedence = {
            "^": 4,
            "*": 3,
            "/": 3,
            "+": 2,
            "-": 2,
            "=": 0,
        };

        return precedence[this.op];
    }

    toHTML() {
        console.assert(this.left && this.right, this);

        if (this.op === '^') {
            return this.left.toHTML() + "<span class='superscript'>" + this.right.toHTML() + "</span>";
        } else {
            let separator = ' ' + this.op + ' ';

            if (this.op === "*") {
                separator = '';

                let rightNeighbor = this.right;
                while (rightNeighbor) {
                    if (rightNeighbor instanceof Function) {
                        separator = ' ';
                        break;
                    }
                    rightNeighbor = rightNeighbor.left;
                }
            }

            let leftSubExpression = this.left.toHTML();
            if (this.left instanceof BinaryOperator && this.left.precedence() < this.precedence()) {
                leftSubExpression = "(" + leftSubExpression + ")";
            }

            let rightSubExpression = this.right.toHTML();
            if (this.right instanceof BinaryOperator && this.right.precedence() < this.precedence()) {
                rightSubExpression = "(" + rightSubExpression + ")";
            }

            return leftSubExpression + separator + rightSubExpression;
        }
    }
}

export class Parenthesis {
    constructor(name) {
        this.name = name;
    }
}