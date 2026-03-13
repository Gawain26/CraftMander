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

function setStatus(message, type) {

    const el = document.getElementById("statusIndicator")

    el.textContent = message

    el.className = ""

    if (type === "loading") el.classList.add("status-loading")
    if (type === "ok") el.classList.add("status-ok")
    if (type === "error") el.classList.add("status-error")
}

async function loadData() {

    setStatus("⏳ Loading datasets...", "loading")

    try {

        const recipeRes = await fetch("data/recipes.json")
        recipes = await recipeRes.json()

        const itemRes = await fetch("data/items_pruned.json")
        items = await itemRes.json()

        buildItemMap()

        console.log("Recipes:", recipes.length)
        console.log("Items:", items.length)

        setStatus("✅ CraftMander data loaded!", "ok")

    } catch (err) {

        console.error(err)

        setStatus("❌ Error loading data", "error")
    }
}

loadData()
