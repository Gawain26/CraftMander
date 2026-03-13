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

let recipes = []
let items = []

async function loadData() {

    const recipeRes = await fetch("data/recipes.json")
    recipes = await recipeRes.json()

    const itemRes = await fetch("data/items.json")
    items = await itemRes.json()

    console.log("Recipes:", recipes.length)
    console.log("Items:", items.length)
}

loadData()
