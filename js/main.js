import * as commonConstants from './commonConstants.js'

// Criminal statistics data is fetched on page load due to long processing time and stored in a global variable for further use
let criminalData = null

// Municipality object is used to store the selected municipality id and name to easily pass it to the functions
let municipality = {
    id: ['SSS'],
    name: 'Finland'
}

// chart type is stored to global variable to make it easier to change it
let chartType = 'line'


// Fetches data from the API with POST method
const fetchApiData = async (url, query) => {
    const response = await fetch(url, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
    })
    return await response.json()
}


// Fetches data from the API with GET method
const fetchData = async (url) => {
    const response = await fetch(url)
    return await response.json()
}


// Initializes the map and adds the data to it
const initMap = async () => {
    let mapData = await fetchData(commonConstants.mapUrl) 

    let map = L.map('map', {
        minZoom: 5,
        maxZoom: 14,
    })

    let geoJson = L.geoJSON(mapData, {
        weight: 2,
        onEachFeature: getFeature
    }).addTo(map)

    let osm = L.tileLayer(commonConstants.openStreetMap, {
    attribution: "© OpenStreetMap"
    }).addTo(map)

    map.fitBounds(geoJson.getBounds())
}


// Adds the feature data to the map and displays it with hover or click event
const getFeature = (feature, layer) => {
    layer.bindTooltip(feature.properties.name)
    layer.on('click', async function (e) {
        const updatedFeature = await getFeatureData(feature)
        displayFeatureData(updatedFeature, layer)})
}


// Displays the feature data in a popup
const displayFeatureData = (feature, layer) => {
    layer.bindPopup(`
    <div>
        ${feature.properties.name}
        <br>
        Latest population: ${feature.properties.latestPopulation}
        <br>
        Latest amount of crimes: ${feature.properties.averageCrimeRate}
        <br>
        Latest employment rate: ${feature.properties.averageEmploymentRate}%
    </div>
    `).openPopup()
}

// Updates the feature with processed data
const getFeatureData = async (feature) => {
    feature = await handleFeatureData(feature)
    return feature
}


// Fetches the population data and adds it to the feature after processing
const handleFeatureData = async (feature) => {
    let id = 'KU' + feature.properties.kunta
    commonConstants.populationQuery.query[1].selection.values = [id]
    let populationData = await fetchApiData(commonConstants.populationUrl, commonConstants.populationQuery)
    feature.properties.latestPopulation = populationData.value[populationData.value.length - 1]
    feature.properties.averageCrimeRate = await getLatestCrimeRate(id)
    feature.properties.averageEmploymentRate = await getLatestEmploymentRate(id)
    return feature
}


// Processes the crime data and returns the latest crime rate
const getLatestCrimeRate = async (id) => {
    let latestCrimes = 0
    let index = commonConstants.criminalStatQuery.query[1].selection.values.indexOf(id)

    latestCrimes = criminalData[310 * 22 + index]

    return latestCrimes
}


// Processes the employment data and returns the latest employment rate
const getLatestEmploymentRate = async (id) => {
    commonConstants.employmentRateQuery.query[0].selection.values = [id]

    let employmentData = await fetchApiData(commonConstants.employmentRateUrl, commonConstants.employmentRateQuery)
    employmentData = Object.values(employmentData.value)

    let employed = employmentData[(employmentData.length / 2) - 1]
    let all = employmentData[employmentData.length - 1] + employed

    return (employed / all * 100).toFixed(2)
}


// Builds the chart with the selected data default data is population for the whole country
const buildChart = async () => {
    commonConstants.populationQuery.query[1].selection.values = municipality.id
    let municipalityData = await fetchApiData(commonConstants.populationUrl, commonConstants.populationQuery)
    let populationData = Object.values(municipalityData.value)
    let chart = new frappe.Chart( "#chart", {
        data: {
        labels: commonConstants.populationQuery.query[0].selection.values,
    
        datasets: [
            {
                type: chartType,
                name: municipality.name,
                values: populationData
            }
        ]},
    
        title: `${municipality.name} statistics chart`,
        type: chartType,
        height: 600,
        colors: ['#007bff']
    })
    document.getElementById('exportBtn').addEventListener('click', () => {chart.export()})
    document.getElementById('populationBtn').addEventListener('click', () => {changeChartData(chart, 'population')})
    document.getElementById('crimeBtn').addEventListener('click', () => {changeChartData(chart, 'crime rate')})
    document.getElementById('employmentBtn').addEventListener('click', () => {changeChartData(chart, 'employment rate')})
}


// Changes the chart data based on the selected data type
const changeChartData = async (chart, dataType) => {
    let data = {}
    data.labels = commonConstants.populationQuery.query[0].selection.values
    data.datasets = [{
        type: chartType,
        name: municipality.name
    }]
    if (dataType === 'population') {
        commonConstants.populationQuery.query[1].selection.values = municipality.id
        let populationData = await fetchApiData(commonConstants.populationUrl, commonConstants.populationQuery)
        populationData = Object.values(populationData.value)
        data.datasets[0].values = populationData
    }
    else if (dataType === 'crime rate') {
        let index = commonConstants.criminalStatQuery.query[1].selection.values.indexOf(municipality.id[0])
        let crimeData = []
        for (let i = 0; i < criminalData.length; i++) {
            if (i % 310 === index) {
                crimeData.push(criminalData[i])
            }
        }
        data.datasets[0].values = crimeData
    }
    else if (dataType === 'employment rate') {
        commonConstants.employmentRateQuery.query[0].selection.values = municipality.id
        let employmentData = await fetchApiData(commonConstants.employmentRateUrl, commonConstants.employmentRateQuery)
        employmentData = Object.values(employmentData.value)

        let employmentArray = employmentData.slice(0, employmentData.length / 2)
        let unemploymentArray = employmentData.slice(employmentData.length / 2, employmentData.length)
        let employmentRate = []

        for (let i = 0; i < employmentArray.length; i++) {
            employmentRate.push((employmentArray[i] / (employmentArray[i] + unemploymentArray[i]) * 100).toFixed(2))
        }

        data.labels = commonConstants.employmentRateQuery.query[3].selection.values
        data.datasets[0].values = employmentRate
    }
    chart.update(data)
}


// Filters the dropdown menu choices based on the input
const filterFunction = () => {
    let input = document.getElementById("input")
    let filter = input.value.toLowerCase()
    let div = document.getElementById("dropdownSelection")
    let a = div.getElementsByTagName("a")

    for (let i = 0; i < a.length; i++) {
        let textValue = a[i].innerText
        if (filter.length > 0 && textValue.toLowerCase().startsWith(filter)) {
            console.log(filter)
            console.log(textValue)
            a[i].style.display = "block"
        } else {
            a[i].style.display = "none"
        }
    }
}


// Loads the dropdown menu with the municipality choices
const loadDropDownMenu = async () => {
    let object = document.getElementById('dropdownList')
    let municipalityData = await fetchData(commonConstants.populationUrl)
    let municipalityArray = Object.values(municipalityData.variables[1].valueTexts)
    
    for (let i = 0; i < municipalityArray.length; i++) {
        let element = document.createElement('a')
        element.href = '#'
        element.className = 'dropdown-item'
        element.id = municipalityData.variables[1].values[i]
        if (municipalityArray[i] === 'WHOLE COUNTRY') {
            element.text = 'Finland'
        }
        else {
            element.text = municipalityArray[i]
        }
        element.addEventListener('click', () => {selectMunicipality(element.id, element.text)})
        object.appendChild(element)
    }
}


// Selects the municipality and hides the dropdown menu
const selectMunicipality = (id, text) => {
    let div = document.getElementById('dropdownSelection')
    let a = div.getElementsByTagName('a')

    for (let i = 0; i < a.length; i++) {
        console.log(a[i].innerText)
        a[i].style.display = 'none'
    }

    document.getElementById('itemBtn').innerText = text
    municipality.id = [id]
    municipality.name = text
    buildChart()
}


// Selects the navigation item and scrolls to the selected section
const selectNavItem = () => {
    const navItems = document.querySelectorAll('.nav-link')
    navItems.forEach(item => {
        item.addEventListener('click', (event) => {
            event.preventDefault()
            
            if (item.id !== 'exportBtn' && item.id !== 'interactiveBtn') {
                navItems.forEach(item => item.classList.remove('active'))
                item.classList.add('active')
            }
            if (item.id === 'mapBtn') {
                document.getElementById('map').scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                })
            }
            else if (item.id === 'chartBtn') {
                document.getElementById('chart').scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                })
            }
            else if (item.id === 'infoBtn') {
                document.getElementById('info').scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                })
            }
        })
    })
}


// Changes the chart type between line and bar
const changeChartType = () => {
    document.getElementById('interactiveBtn').addEventListener('click', () => {
        if (chartType === 'line') {
            chartType = 'bar'
        }
        else {
            chartType = 'line'
        }
        buildChart()
    })
}


// Loads the data from the API and calls the functions to build the page
const loadData = async () => {
    criminalData = await fetchApiData(commonConstants.criminalStatUrl, commonConstants.criminalStatQuery)
    criminalData = Object.values(criminalData.value)
    loadDropDownMenu()
    document.getElementById('input').addEventListener('keyup', filterFunction)
    selectNavItem()
    initMap()
    changeChartType()
    buildChart()
}


document.addEventListener('DOMContentLoaded', loadData)
