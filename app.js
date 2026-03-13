let materials = {}
let trackedRecipes = []

function loadAccount() {
  const key = document.getElementById("apikey").value
  console.log("API key entered:", key)
}

function searchRecipes() {
  const term = document.getElementById("searchBox").value
  console.log("Searching for:", term)
}
