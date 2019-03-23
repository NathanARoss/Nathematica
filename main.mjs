const queryForm = document.getElementById("query-bar");
const queryInput = queryForm.querySelector("input[type='text']");
const inputInterpretation = document.getElementById("input-interpretation");

queryForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const query = queryInput.value;
    //process query

    inputInterpretation.innerHTML = "";
    const text = document.createTextNode(query);
    inputInterpretation.appendChild(text);

    return false;
});