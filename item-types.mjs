class ASTNode {
    constructor(value, left, right) {
        this.value = value;
        this.left = left;
        this.right = right;
    }

    sort() {

    }

    toHTML() {
        return "";
    }

    simplify() {
        return false;
    }
}

export class Number extends ASTNode {
    constructor(value) {
        super(+value);
    }

    toHTML() {
        return String(this.value);
    }
}

export class Variable extends ASTNode {
    constructor(name) {
        super(name);
    }

    toHTML() {
        return String(this.value);
    }
}

export class Function extends ASTNode {
    constructor(name, left, right) {
        super(name, left, right);
    }

    toHTML() {
        return String(this.value) + "(" + this.left.toHTML() + ")";
    }
}

export class BinaryOperator extends ASTNode {
    constructor(op, left, right) {
        super(op, left, right);
    }

    sort() {
        //sort the left and right hand side so literals prefer being on the left
        if (this.value === '*' && !(this.left instanceof Number) && this.right instanceof Number) {
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

        return precedence[this.value];
    }

    toHTML() {
        console.assert(this.left && this.right, this);

        if (this.value === '^') {
            return this.left.toHTML() + "<span class='superscript'>" + this.right.toHTML() + "</span>";
        } if (this.value === '/') {
            return "<div class='ratio'><span>" + this.left.toHTML() + "</span><span>" + this.right.toHTML() + "</span></div>";
        } else {
            let separator = ' ' + this.value + ' ';

            if (this.value === "*" && !(this.left instanceof Number && this.right instanceof Number)) {
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

    simplify(parent, isRight) {
        let simplified = this.left.simplify(this, false);

        if (simplified) {
            console.log("left side", this.left, "was simplfied")
        }

        if (!simplified) {
            simplified = this.right.simplify(this, true);

            if (simplified) {
                console.log("right side", this.right, "was simplfied")
            }
        }

        console.log("got here")
        if (!simplified && parent) {
            console.log("got here")
            if (this.left instanceof Number && this.right instanceof Number) {
                console.log("got here")
                const left = this.left.value;
                const right = this.right.value;

                /**
                    "^": 4,
                    "*": 3,
                    "/": 3,
                    "+": 2,
                    "-": 2,
                    "=": 0,
                 */

                let result = 0;
                switch (this.value) {
                    case '+':
                        result = left + right;
                        break;
                    case '-':
                        result = left - right;
                        break;
                    case '*':
                        result = left * right;
                        break;
                    case '/':
                        result = left / right;
                        break;
                    case '^':
                        result = Math.pow(left, right);
                        break;
                }

                const newNode = new Number(result);
                if (isRight) {
                    parent.right = newNode;
                } else {
                    parent.left = newNode;
                }

                simplified = true;
            }
        }

        return simplified;
    }
}

export class Parenthesis extends ASTNode {
    constructor(name) {
        super(name);
    }
}