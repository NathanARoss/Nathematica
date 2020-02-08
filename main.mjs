import * as ItemTypes from "./item-types.mjs";
import {
    enableGraph,
    disableGraph
} from "./2d-graph.mjs";

const queryForm = document.getElementById("query-bar");
const queryInput = queryForm.querySelector("input[type='text']");
const inputInterpretation = document.getElementById("input-interpretation");
const graphEquation = document.getElementById("graph-equation");
const solutionSteps = document.getElementById("solution-steps");
const solutionContainer = document.getElementById("solution-container");
const graphEquationContainer = document.getElementById("graph-equation-container");

//queue this function because browsers sometimes autocomplete the input field after
//the initial page load event
setTimeout(function () {
    if (!queryInput.value && window.location.hash !== "") {
        let query = decodeURIComponent(window.location.hash);
        if (query.startsWith("#query=")) {
            query = query.substr(7);
        }
        queryInput.value = query;
    }

    if (queryInput.value) {
        processQuery(queryInput.value)
    }
}, 0);

queryForm.addEventListener("submit", function (event) {
    //do not perform a form submission
    event.preventDefault();

    //ignore whitespace in query
    const query = queryInput.value.replace(/\s/g, '');

    //add the query to the URL so it is saved between page reloads and can be shared
    window.location.hash = "#query=" + encodeURIComponent(query);

    processQuery(query);

    return false;
});

//take an expression or equation as a string and populate the UI with it
function processQuery(query) {
    const ast = getAST(query);
    inputInterpretation.innerHTML = ast.getHTML();

    //simplify the expression and display each step of the process.
    //stop when attempts to further simplify fail
    solutionContainer.style.display = "none";
    solutionSteps.innerHTML = "";

    let previousHTML = "";
    let simplifiedAst = ast;

    for (let i = 0; i < 20; ++i) {
        const html = simplifiedAst.getHTML();
        if (html === previousHTML) {
            if (i > 1) {
                //only show a solution if a simplification step occured
                //and a simplest form was found within n steps
                solutionContainer.style.display = "";
            }
            break;
        }

        const step = document.createElement("div");
        step.innerHTML = html;
        // step.innerHTML = simplifiedAst.getTreeHTML(); //DEBUG
        step.classList.add("formula-display");
        solutionSteps.appendChild(step);

        previousHTML = html;
        simplifiedAst = simplifiedAst.simplify();
    }

    //if the equation or expression can be meaningfully graphed, graph it in WebGL
    if (query.includes('x') || query.includes('y')) {
        try {
            let glslExpression;
            let graphableAst = simplifiedAst;

            //check if the user entered an expression instead of an equation
            if (!(graphableAst instanceof ItemTypes.BinaryOperator && graphableAst.value === '=')) {
                //attempt to meaningfully autocomplete the missing half of the equation

                if (query.includes('x') && query.includes('y')) {
                    graphableAst = new ItemTypes.BinaryOperator("=", graphableAst, new ItemTypes.NumericLiteral(1.0));
                } else if (query.includes('y')) {
                    graphableAst = new ItemTypes.BinaryOperator("=", new ItemTypes.Variable("x"), graphableAst);
                } else {
                    graphableAst = new ItemTypes.BinaryOperator("=", new ItemTypes.Variable("y"), graphableAst);
                }

                //notify the user as to how their expression was interpretted as a equation
                graphEquation.innerHTML = graphableAst.getHTML();
                graphEquationContainer.style.display = "";
            } else {
                graphEquationContainer.style.display = "none";
            }

            glslExpression = graphableAst.right.getGLSL() + " - (" + graphableAst.left.getGLSL() + ")";
            enableGraph(glslExpression);
        } catch (e) {
            console.error(e);
        }
    } else {
        disableGraph();
        graphEquationContainer.style.display = "none";
    }
}

//parse the expression or equation into an abstract syntax tree
function getAST(expressionString) {
    //detect known variable and function names before they are split into individual characters
    const tokens = expressionString.match(/\d+[.]?\d*|\d*[.]?\d+|cos|sin|tan|abs|floor|ceil|theta|pi|[a-zπΠΘθ]|[-=+*^\\/()]/gi);

    if (!tokens || tokens.length === 0) {
        return new ItemTypes.ASTNode();
    }

    //keep a list of subexpressions and operators to ensure order of ops is respected
    const expression = [];
    const opStack = [];

    //this is a JavaScript symbol rather than a math symbol
    const LEFT_PARENTHESIS = Symbol("left parenthesis");

    function addNode(item) {
        //only binary operators have a 2nd operand
        if (item instanceof ItemTypes.BinaryOperator) {
            item.right = expression.pop();
        }

        item.left = expression.pop();
        expression.push(item);
    }

    function peekOpStack() {
        return opStack[opStack.length - 1];
    }

    //this is its own function to reduce code duplication
    function pushOperator(op) {
        //manage operator precendence
        const item = new ItemTypes.BinaryOperator(op);
        let opPrecendence = item.precedence();

        if (op === '^') {
            //exponents are processed right-to-left rather than left-to-right,
            //so prioritize this exponent over those earlier in the equation
            ++opPrecendence;
        }

        while (opStack.length > 0) {
            const queuedOperator = peekOpStack();
            if (queuedOperator instanceof ItemTypes.BinaryOperator && opPrecendence <= queuedOperator.precedence()) {
                //process all binary operators that have a higher precedence than the one in the function parameter
                addNode(opStack.pop());
            } else {
                break;
            }
        }

        opStack.push(item);
    }

    for (let i = 0; i < tokens.length; ++i) {
        const token = tokens[i];

        //detect implicit multiplication as the occurance of two variables|numbers|function
        //identifiers written next to each other
        if (/\d+[.]?\d*|\d*[.]?\d+|cos|sin|tan|abs|floor|ceil|theta|pi|[a-zπΠΘθ]/i.test(token)) {
            if (i > 0 && /\d+[.]?\d*|\d*[.]?\d+|theta|pi|[a-zπΠΘθ]/i.test(tokens[i - 1])) {
                pushOperator('*');
            }
        }

        if (/cos|sin|tan|abs|floor|ceil/i.test(token)) {
            opStack.push(new ItemTypes.Function(token));
        } else if (/\d+|theta|pi|[a-zπΠΘθ]/i.test(token)) {
            if (/\d+[.]?\d*|\d*[.]?\d+/.test(token)) {
                expression.push(new ItemTypes.NumericLiteral(token));
            } else {
                //replace Greek letter names with the corresponding characters
                let name = token;
                if (token.toLowerCase() === "theta") {
                    name = 'θ';
                } else if (token.toLowerCase() === "pi") {
                    name = 'π';
                }
                expression.push(new ItemTypes.Variable(name));
            }
        } else if (/[-=+*^\\/]/.test(token)) {
            pushOperator(token);
        } else if (token === '(') {
            opStack.push(LEFT_PARENTHESIS)
        } else if (token === ')') {
            //move everything between the ( and the matching ) to the expression
            while (opStack.length > 0) {
                const op = opStack.pop();
                if (op === LEFT_PARENTHESIS) {
                    break;
                }
                addNode(op);
            }

            if (opStack.length > 0 && peekOpStack() instanceof ItemTypes.Function) {
                //detect if this set of parenthesis is a set of function arguments
                addNode(opStack.pop());
            } else if (expression.length > opStack.length + 1) {
                //detect implicit multiplication like y = 2(x(y)) meaning 2*x*y
                pushOperator('*');
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