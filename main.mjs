import * as ItemTypes from "./item-types.mjs";
import {
    enableGraph,
    disableGraph
} from "./2d-graph.mjs";

const queryForm = document.getElementById("query-bar");
const queryInput = queryForm.querySelector("input[type='text']");
const inputInterpretation = document.getElementById("input-interpretation");
const solutionSteps = document.getElementById("solution-steps");

setTimeout(function () {
    if (queryInput.value) {
        processQuery(queryInput.value)
    }
}, 0);

queryForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const query = queryInput.value;
    processQuery(query);

    return false;
});

function processQuery(query) {
    const ast = getAST(query);
    console.dir(ast);

    const out = ast.getHTML();
    inputInterpretation.innerHTML = out;

    if (query.includes('x') || query.includes('y')) {
        try {
            let glslExpression;

            if (ast instanceof ItemTypes.BinaryOperator && ast.value === '=') {
                //query has both sides of an equal sign
                glslExpression = ast.right.getGLSL() + " - (" + ast.left.getGLSL() + ")";
            } else {
                //only one side is written, so I make a guess at the missing half
                glslExpression = ast.getGLSL();

                if (query.includes('x') && query.includes('y')) {
                    glslExpression += " - 1.0";
                } else if (query.includes('y')) {
                    glslExpression += " - x";
                } else {
                    glslExpression += " - y";
                }
            }

            enableGraph(glslExpression);
        } catch (e) {
            console.error(e);
        }
    }
    else {
        disableGraph();
    }

    //simplify the expression and print each step of the simplification
    //stop when the resulting expression is the same as the previous step
    solutionSteps.innerHTML = "";

    let previousHTML = "";
    let simplifiedAst = ast;

    for (let i = 0; i < 10; ++i) {
        const html = simplifiedAst.getHTML();
        if (html === previousHTML) {
            break;
        }
        previousHTML = html;
        simplifiedAst = simplifiedAst.simplify();

        const step = document.createElement("div");
        step.innerHTML = html;
        step.classList.add("formula-display");
        solutionSteps.appendChild(step);
    }
}

function getAST(expressionString) {
    const tokens = expressionString.match(/\d+[.]?\d*|\d*[.]?\d+|cos|sin|tan|abs|floor|theta|pi|[a-zπΠΘθ]|[-=+*^\\/()]/gi);

    if (!tokens || tokens.length === 0) {
        return false;
    }

    const expression = [];
    const opStack = [];

    const LEFT_PARENTHESIS = new ItemTypes.Parenthesis("(");

    function addNode(item) {
        item.right = null;
        if (item instanceof ItemTypes.BinaryOperator) {
            item.right = expression.pop();
        }

        item.left = expression.pop();
        expression.push(item);
    }

    function peekOpStack() {
        return opStack[opStack.length - 1];
    }

    //this is its own function so I can manually insert implicit multiplications
    function handleOperator(op) {
        //manage operator precendence
        let item;

        if (op === '/') {
            item = new ItemTypes.Ratio()
        } else {
            item = new ItemTypes.BinaryOperator(op)
        }

        while (
            opStack.length > 0 && peekOpStack() instanceof ItemTypes.BinaryOperator &&
            (
                (op !== '^' && item.precedence() <= peekOpStack().precedence()) ||
                (op === '^' && item.precedence() < peekOpStack().precedence())
            )
        ) {
            addNode(opStack.pop());
        }
        opStack.push(item);
    }

    for (let i = 0; i < tokens.length; ++i) {
        const token = tokens[i];

        //detect implicit multiplication
        if (/\d+|cos|sin|tan|abs|floor|theta|pi|[a-zπΠΘθ]/i.test(token)) {
            if (i > 0 && /\d+|theta|pi|[a-zπΠΘθ]/i.test(tokens[i - 1])) {
                handleOperator('*');
            }
        }

        if (/cos|sin|tan|abs|floor/i.test(token)) {
            opStack.push(new ItemTypes.Function(token));
        } else if (/\d+|theta|pi|[a-zπΠΘθ]/i.test(token)) {
            if (/\d+/.test(token)) {
                expression.push(new ItemTypes.Number(token));
            } else {
                let name = token;
                if (token.toLowerCase() === "theta") {
                    name = 'θ';
                } else if (token.toLowerCase() === "pi") {
                    name = 'π';
                }
                expression.push(new ItemTypes.Variable(name));
            }
        } else if (/[-=+*^\\/]/.test(token)) {
            handleOperator(token);
        } else if (token === '(') {
            opStack.push(LEFT_PARENTHESIS)
        } else if (token === ')') {
            //move everything between the ) and the matching ( to the expression
            while (opStack.length > 0 && peekOpStack() !== LEFT_PARENTHESIS) {
                addNode(opStack.pop());
            }

            //pop left parenthesis
            console.assert(opStack.pop() === LEFT_PARENTHESIS, "meant to pop lparen");

            //catch function calls to the left of of parenthesis
            if (opStack.length > 0 && peekOpStack() instanceof ItemTypes.Function) {
                addNode(opStack.pop());
            } else if (expression.length > opStack.length + 1) {
                // console.log("I think there is a function-style multiplication going on here.", expression, opStack);
                //catch use cases like y = 2(x(y)) meaning 2*x*y
                handleOperator('*');
            }
        }
    }

    //move remaining operators
    while (opStack.length > 0) {
        addNode(opStack.pop());
    }

    const ast = expression.pop();
    console.assert(expression.length === 0, "expression should have no more entries", ...expression);

    return ast;
}