import { useEffect, useState } from 'react'
import './sass/App.scss'
import { Bar, Line } from 'react-chartjs-2'
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	BarElement,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Legend,
	Filler,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler, annotationPlugin)

function App() {
	const [data, setData] = useState([])
	const [counter, setCounter] = useState(0)
	const [loading, setLoading] = useState(false)
	const [showFullYear, setShowFullYear] = useState(false)
	const [heatmapMode, setHeatmapMode] = useState('total') // 'total' or 'count'
	const [activeTooltip, setActiveTooltip] = useState(null)

	const scrollToSection = (sectionId) => {
		const element = document.getElementById(sectionId)
		if (element) {
			element.scrollIntoView({ behavior: 'smooth' })
		}
	}

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true)
				const response = await fetch('https://backend-pluviometria-production.up.railway.app/api/get-data', {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				})

				if (!response.ok) {
					throw new Error('La petición falló')
				}

				const completeData = await response.json()
				setData(completeData.data)
				setCounter(completeData.counter.count)
			} catch (error) {
				console.error('Error al realizar la petición:', error)
			} finally {
				setLoading(false)
			}
		}

		fetchData()
	}, [])

	const today = new Date()
	const currentMonth = today.getMonth()
	const currentDate = today.getDate()
	const currentHydrologicalYear = today.getFullYear() - (currentMonth < 8 ? 1 : 0)

	const formatDate = (date) => {
		const newDate = new Date(date)
		return newDate.toLocaleDateString('es-ES')
	}

	const getHydrologicalYear = (date) => {
		const newDate = new Date(date)
		let year = newDate.getFullYear()
		if (newDate.getMonth() < 8) {
			year -= 1
		}
		return year
	}

	const formatData = (data) => {
		const organizedData = data.reduce((acc, item) => {
			const itemDate = new Date(item.fecha)
			const hydroYear = getHydrologicalYear(item.fecha)
			const month = itemDate.getMonth()

			if (!acc[hydroYear]) {
				acc[hydroYear] = { monthlyTotals: Array(12).fill(0), data: [], previousYearAccumulated: 0 }
			}

			acc[hydroYear].data.push({ ...item, fecha: formatDate(item.fecha), fechaOriginal: item.fecha })
			acc[hydroYear].monthlyTotals[month] += item.litros

			return acc
		}, {})

		// Asegurar que el año hidrológico actual existe en organizedData
		if (!organizedData[currentHydrologicalYear]) {
			organizedData[currentHydrologicalYear] = { monthlyTotals: Array(12).fill(0), data: [], previousYearAccumulated: 0, averagePreviousYears: 0 }
		}

		// Calcular acumulado del año anterior por estas fechas
		data.forEach((item) => {
			const itemDate = new Date(item.fecha)
			const itemYear = getHydrologicalYear(item.fecha)

			// Solo considerar registros del año hidrológico anterior (2023)
			if (itemYear === currentHydrologicalYear - 1) {
				// Crear rango desde 1 septiembre del año anterior hasta la fecha actual del año anterior
				const startOfPreviousYear = new Date(currentHydrologicalYear - 1, 8, 1) // 1 septiembre 2023
				const equivalentDateLastYear = new Date(currentHydrologicalYear - 1, currentMonth, currentDate) // 11 septiembre 2024

				if (itemDate >= startOfPreviousYear && itemDate <= equivalentDateLastYear) {
					organizedData[currentHydrologicalYear].previousYearAccumulated += item.litros
				}
			}
		})

		// Calcular media de años anteriores (desde 2015-2016) por estas fechas
		const startYearForAverage = 2015
		const yearsToConsider = []
		
		for (let year = startYearForAverage; year < currentHydrologicalYear; year++) {
			let accumulatedForYear = 0
			
			data.forEach((item) => {
				const itemDate = new Date(item.fecha)
				const itemYear = getHydrologicalYear(item.fecha)
				
				if (itemYear === year) {
					// Crear rango desde 1 septiembre hasta la fecha actual del año correspondiente
					const startOfYear = new Date(year, 8, 1)
					const equivalentDateInYear = new Date(year, currentMonth, currentDate)
					
					if (itemDate >= startOfYear && itemDate <= equivalentDateInYear) {
						accumulatedForYear += item.litros
					}
				}
			})
			
			yearsToConsider.push(accumulatedForYear)
		}
		
		// Calcular la media
		if (yearsToConsider.length > 0) {
			const sum = yearsToConsider.reduce((acc, val) => acc + val, 0)
			organizedData[currentHydrologicalYear].averagePreviousYears = sum / yearsToConsider.length
		}

		// Asegurarse de que los totales anuales se calculan correctamente
		Object.keys(organizedData).forEach((year) => {
			const totalAnnual = organizedData[year].monthlyTotals.reduce((sum, current) => sum + current, 0)
			organizedData[year].totalAnnual = totalAnnual
		})

		// Ordenar los datos por fecha
		Object.keys(organizedData).forEach((year) => {
			organizedData[year].data.sort((a, b) => {
				const dateA = new Date(a.fechaOriginal)
				const dateB = new Date(b.fechaOriginal)
				return dateA - dateB
			})
		})

		return organizedData
	}

	const organizedData = formatData(data)
	let mostRecentDate = data.length > 0 ? new Date(Math.max(...data.map((e) => new Date(e.fecha).getTime()))) : today
	let daysWithoutRain = Math.floor((today - mostRecentDate) / (1000 * 60 * 60 * 24))

	const years = Object.keys(organizedData).sort((a, b) => b - a)
	const oldestHydrologicalYear = years[years.length - 1]

	const adjustedMonthlyTotals = (monthlyTotals) => {
		const startOfHydrologicalYear = 8
		return [
			...monthlyTotals.slice(startOfHydrologicalYear), // De septiembre a diciembre
			...monthlyTotals.slice(0, startOfHydrologicalYear), // De enero a agosto
		].map((total) => parseFloat(total.toFixed(1))) // Redondeo a un decimal
	}

	// Calcular media anual de todos los años (desde 2014-2015)
	const calculateYearlyAverage = () => {
		const startYearForAverage = 2014
		const yearlyTotals = []

		Object.keys(organizedData).forEach((year) => {
			const yearNum = parseInt(year)
			// Solo años completos (desde 2014 hasta el año anterior al actual)
			if (yearNum >= startYearForAverage && yearNum < currentHydrologicalYear) {
				const total = yearNum === parseInt(oldestHydrologicalYear) ? 473 : (organizedData[year]?.totalAnnual || 0)
				yearlyTotals.push(total)
			}
		})

		if (yearlyTotals.length > 0) {
			const sum = yearlyTotals.reduce((acc, val) => acc + val, 0)
			return sum / yearlyTotals.length
		}
		return 0
	}

	const yearlyAverage = calculateYearlyAverage()

	// Calcular media mensual desde 2015-2016
	const calculateMonthlyAverages = () => {
		const startYearForAverage = 2015
		const monthlyAccumulated = Array(12).fill(0)
		
		// Contar años completos para la media
		let totalYears = 0
		Object.keys(organizedData).forEach((year) => {
			const yearNum = parseInt(year)
			if (yearNum >= startYearForAverage && yearNum < currentHydrologicalYear) {
				totalYears++
				organizedData[year].monthlyTotals.forEach((total, monthIndex) => {
					monthlyAccumulated[monthIndex] += total
				})
			}
		})

		// Calcular media dividiendo por el número total de años
		const averages = monthlyAccumulated.map((sum) => 
			totalYears > 0 ? parseFloat((sum / totalYears).toFixed(1)) : 0
		)

		// Reordenar: septiembre a agosto
		return [
			...averages.slice(8), // Sept, Oct, Nov, Dic
			...averages.slice(0, 8), // Ene, Feb, Mar, Abr, May, Jun, Jul, Ago
		]
	}

	const monthlyAverages = calculateMonthlyAverages()

	// Configuración para la gráfica: se ordenan los años de forma ascendente
	const yearsAscending = [...years].reverse()
	const chartData = {
		labels: yearsAscending.map((year) => `${year}-${parseInt(year) + 1}`),
		datasets: [
			{
				label: 'Total Litros',
				data: yearsAscending.map((year) =>
					year === oldestHydrologicalYear ? 473 : (organizedData[year]?.totalAnnual || 0)
				),
				backgroundColor: 'rgba(2, 117, 216, 0.5)',
				borderColor: 'rgba(2, 117, 216, 1)',
				borderWidth: 1,
			},
		],
	}
	const options = {
		responsive: true,
		plugins: {
			legend: {
				position: 'top',
			},
			title: {
				display: true,
				text: 'Datos anuales',
			},
			annotation: {
				annotations: {
					line1: {
						type: 'line',
						yMin: yearlyAverage,
						yMax: yearlyAverage,
						borderColor: 'rgba(255, 99, 132, 0.8)',
						borderWidth: 2,
						borderDash: [6, 6],
						label: {
							display: true,
							content: `Media: ${yearlyAverage.toFixed(1)} L`,
							position: 'end',
							backgroundColor: 'rgba(255, 99, 132, 0.8)',
							color: 'white',
							font: {
								size: 12,
								weight: 'bold',
							},
						},
					},
				},
			},
		},
	}

	// Configuración para la gráfica de medias mensuales
	const monthNames = [
		'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
		'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto'
	]

	const monthlyAverageChartData = {
		labels: monthNames,
		datasets: [
			{
				label: 'Media de Litros',
				data: monthlyAverages,
				backgroundColor: 'rgba(75, 192, 192, 0.5)',
				borderColor: 'rgba(75, 192, 192, 1)',
				borderWidth: 1,
			},
		],
	}

	const monthlyAverageOptions = {
		responsive: true,
		plugins: {
			legend: {
				position: 'top',
			},
			title: {
				display: true,
				text: `Media mensual de litros`,
			},
		},
		scales: {
			y: {
				beginAtZero: true,
			},
		},
	}

	// Calcular progresión acumulada del año actual vs media histórica
	const calculateProgressionData = () => {
		const startYearForAverage = 2015
		
		// Generar etiquetas para cada día del año hidrológico (1 sept - 31 ago)
		const generateDayLabels = () => {
			const labels = []
			const monthsOrder = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7] // Sept a Ago
			const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
			const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
			
			monthsOrder.forEach((month) => {
				for (let day = 1; day <= daysInMonth[month]; day++) {
					// Solo mostrar etiqueta el día 1 de cada mes para no saturar
					if (day === 1) {
						labels.push(`1 ${monthNames[month]}`)
					} else {
						labels.push('')
					}
				}
			})
			return labels
		}

		// Convertir fecha a día del año hidrológico (0 = 1 sept, 365 = 31 ago)
		const getHydrologicalDayOfYear = (date) => {
			const d = new Date(date)
			const month = d.getMonth()
			const day = d.getDate()
			const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
			const monthsOrder = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7]
			
			let dayOfYear = 0
			for (let i = 0; i < monthsOrder.length; i++) {
				if (monthsOrder[i] === month) {
					dayOfYear += day - 1
					break
				}
				dayOfYear += daysInMonth[monthsOrder[i]]
			}
			return dayOfYear
		}

		// Calcular acumulado día a día para el año actual
		const currentYearDaily = Array(365).fill(0)
		if (organizedData[currentHydrologicalYear]) {
			organizedData[currentHydrologicalYear].data.forEach((item) => {
				const dayIndex = getHydrologicalDayOfYear(item.fechaOriginal)
				if (dayIndex >= 0 && dayIndex < 365) {
					currentYearDaily[dayIndex] += item.litros
				}
			})
		}

		// Convertir a acumulado
		const currentYearAccumulated = []
		let cumSum = 0
		const todayDayIndex = getHydrologicalDayOfYear(today)
		
		for (let i = 0; i <= todayDayIndex && i < 365; i++) {
			cumSum += currentYearDaily[i]
			currentYearAccumulated.push(parseFloat(cumSum.toFixed(1)))
		}

		// Calcular media histórica día a día
		const historicalDailyAccumulated = Array(365).fill(0).map(() => ({ sum: 0, count: 0 }))
		
		Object.keys(organizedData).forEach((year) => {
			const yearNum = parseInt(year)
			if (yearNum >= startYearForAverage && yearNum < currentHydrologicalYear) {
				const yearDaily = Array(365).fill(0)
				
				organizedData[year].data.forEach((item) => {
					const dayIndex = getHydrologicalDayOfYear(item.fechaOriginal)
					if (dayIndex >= 0 && dayIndex < 365) {
						yearDaily[dayIndex] += item.litros
					}
				})

				// Convertir a acumulado para este año
				let yearCumSum = 0
				for (let i = 0; i < 365; i++) {
					yearCumSum += yearDaily[i]
					historicalDailyAccumulated[i].sum += yearCumSum
					historicalDailyAccumulated[i].count += 1
				}
			}
		})

		// Calcular media
		const averageAccumulated = historicalDailyAccumulated.map((day) => 
			day.count > 0 ? parseFloat((day.sum / day.count).toFixed(1)) : 0
		)

		return {
			labels: generateDayLabels(),
			currentYear: currentYearAccumulated,
			averageYear: averageAccumulated.slice(0, todayDayIndex + 1),
			fullAverage: averageAccumulated,
		}
	}

	const progressionData = calculateProgressionData()

	const progressionChartData = {
		labels: showFullYear ? progressionData.labels : progressionData.labels.slice(0, progressionData.currentYear.length),
		datasets: [
			{
				label: `Año actual`,
				data: progressionData.currentYear,
				borderColor: 'rgba(2, 117, 216, 1)',
				backgroundColor: 'rgba(2, 117, 216, 0.1)',
				fill: true,
				tension: 0.3,
				pointRadius: 0,
				borderWidth: 2,
			},
			{
				label: 'Media histórica',
				data: showFullYear ? progressionData.fullAverage : progressionData.averageYear,
				borderColor: 'rgba(255, 99, 132, 1)',
				backgroundColor: 'rgba(255, 99, 132, 0.1)',
				fill: showFullYear ? false : true,
				tension: 0.3,
				pointRadius: 0,
				borderWidth: 2,
				borderDash: [5, 5],
			},
		],
	}

	const progressionOptions = {
		responsive: true,
		interaction: {
			mode: 'index',
			intersect: false,
		},
		plugins: {
			legend: {
				position: 'top',
			},
			title: {
				display: true,
				text: 'Año actual vs Media histórica',
			},
		},
		scales: {
			y: {
				beginAtZero: true,
				title: {
					display: true,
					text: 'Litros acumulados',
				},
			},
			x: {
				ticks: {
					maxRotation: 45,
					minRotation: 45,
				},
			},
		},
	}

	// Calcular mapa de calor de días del año
	const calculateHeatmapData = () => {
		const dailyRainfall = {} // { 'MM-DD': { sum: X, count: Y, entries: [{year, litros}] } }
		const startYear = 2015 // Excluir 2014 porque no tiene datos de sept/oct

		data.forEach((item) => {
			const itemDate = new Date(item.fecha)
			const year = itemDate.getFullYear()
			if (year >= startYear) {
				const month = String(itemDate.getMonth() + 1).padStart(2, '0')
				const day = String(itemDate.getDate()).padStart(2, '0')
				const key = `${month}-${day}`

				if (!dailyRainfall[key]) {
					dailyRainfall[key] = { sum: 0, count: 0, entries: [] }
				}
				dailyRainfall[key].sum += item.litros
				dailyRainfall[key].count += 1
				dailyRainfall[key].entries.push({ year, litros: item.litros })
			}
		})

		// Calcular media para cada día
		const heatmapData = {}
		Object.keys(dailyRainfall).forEach((key) => {
			// Ordenar entries por año descendente
			const sortedEntries = dailyRainfall[key].entries.sort((a, b) => b.year - a.year)
			heatmapData[key] = {
				average: dailyRainfall[key].sum / dailyRainfall[key].count,
				total: dailyRainfall[key].sum,
				count: dailyRainfall[key].count,
				entries: sortedEntries,
			}
		})

		return heatmapData
	}

	const heatmapData = calculateHeatmapData()

	// Encontrar el valor máximo para la escala de colores (depende del modo)
	const maxValue = heatmapMode === 'total' 
		? Math.max(...Object.values(heatmapData).map(d => d.total), 1)
		: Math.max(...Object.values(heatmapData).map(d => d.count), 1)

	// Función para obtener el color basado en la intensidad
	const getHeatColor = (dayData) => {
		const value = heatmapMode === 'total' ? dayData.total : dayData.count
		if (value === 0) return '#f0f2f5'
		const intensity = Math.min(value / maxValue, 1)
		// Escala de azules: más lluvia = más oscuro
		if (intensity < 0.1) return '#e3f2fd'
		if (intensity < 0.2) return '#bbdefb'
		if (intensity < 0.3) return '#90caf9'
		if (intensity < 0.4) return '#64b5f6'
		if (intensity < 0.5) return '#42a5f5'
		if (intensity < 0.6) return '#2196f3'
		if (intensity < 0.7) return '#1e88e5'
		if (intensity < 0.8) return '#1976d2'
		if (intensity < 0.9) return '#1565c0'
		return '#0d47a1'
	}

	// Cerrar tooltip al hacer click fuera
	const handleHeatmapContainerClick = (e) => {
		if (e.target.classList.contains('heatmap-container') || 
			e.target.classList.contains('heatmap-grid') ||
			e.target.classList.contains('heatmap-days')) {
			setActiveTooltip(null)
		}
	}

	// Generar estructura del calendario
	const generateCalendarData = () => {
		const months = [
			{ name: 'Ene', days: 31, month: '01' },
			{ name: 'Feb', days: 29, month: '02' },
			{ name: 'Mar', days: 31, month: '03' },
			{ name: 'Abr', days: 30, month: '04' },
			{ name: 'May', days: 31, month: '05' },
			{ name: 'Jun', days: 30, month: '06' },
			{ name: 'Jul', days: 31, month: '07' },
			{ name: 'Ago', days: 31, month: '08' },
			{ name: 'Sep', days: 30, month: '09' },
			{ name: 'Oct', days: 31, month: '10' },
			{ name: 'Nov', days: 30, month: '11' },
			{ name: 'Dic', days: 31, month: '12' },
		]
		return months
	}

	const calendarMonths = generateCalendarData()

	if (loading) {
		return (
			<div>
				<header className='app-header'>
					<div className='header-text'>
						<h1>Registro de lluvias de Castillo de Locubín</h1>
						<p>Datos recogidos por Rafael Muñoz y Jose Manuel Domínguez</p>
					</div>
				</header>
				<div className='loader'></div>
			</div>
		)
	}
	return (
		<div>
			<header className='app-header'>
				<div className='header-text'>
					<h1>Registro de lluvias de Castillo de Locubín</h1>
					<p>Datos recogidos por Rafael Muñoz y Jose Manuel Domínguez</p>
				</div>
				<nav className='nav-menu nav-desktop'>
					<button onClick={() => scrollToSection('resumen')}>Resumen</button>
					<button onClick={() => scrollToSection('historico')}>Histórico</button>
					<button onClick={() => scrollToSection('graficos')}>Gráficos</button>
					<button onClick={() => scrollToSection('datos')}>Datos</button>
				</nav>
			</header>
			<nav className='nav-menu nav-mobile'>
				<button onClick={() => scrollToSection('resumen')}>Resumen</button>
				<button onClick={() => scrollToSection('historico')}>Histórico</button>
				<button onClick={() => scrollToSection('graficos')}>Gráficos</button>
				<button onClick={() => scrollToSection('datos')}>Datos</button>
			</nav>
			<div className='main-content'>
			<section id='resumen' className='section'>
			<h2>Resumen del año actual</h2>
			<div className='year'>
				<table className='general-table'>
					<tbody>
						<tr>
							<td>Total litros este año hidrológico</td>
							<td style={{ textAlign: 'center' }}>
								{(organizedData[currentHydrologicalYear]?.totalAnnual || 0).toFixed(1)}
							</td>
						</tr>
						<tr>
							<td>Media de litros años hidrológicos anteriores por estas fechas</td>
							<td style={{ textAlign: 'center' }}>
								{(organizedData[currentHydrologicalYear]?.averagePreviousYears || 0).toFixed(1)}
							</td>
						</tr>
						<tr>
							<td>Litros año hidrológico anterior por estas fechas</td>
							<td style={{ textAlign: 'center' }}>
								{(organizedData[currentHydrologicalYear]?.previousYearAccumulated || 0).toFixed(1)}
							</td>
						</tr>
						<tr>
							<td>Días sin llover</td>
							<td style={{ textAlign: 'center' }}>{daysWithoutRain}</td>
						</tr>
					</tbody>
				</table>
			</div>
			</section>

			{/* Nueva tabla: Total años anteriores */}
			<section id='historico' className='section'>
			<h2>Total años anteriores</h2>
			<div className='total-year'>
				<table className='table general-table'>
					<thead>
						<tr>
							<th>Año hidrológico</th>
							<th>Total litros</th>
						</tr>
					</thead>
					<tbody>
						{years.map((year) => (
							<tr key={year}>
								<td>
									{year}-{parseInt(year) + 1}
								</td>
								<td style={{ textAlign: 'center' }}>
									{year === oldestHydrologicalYear
										? (473).toFixed(1)
										: (organizedData[year]?.totalAnnual || 0).toFixed(1)}
								</td>
							</tr>
						))}
						<tr style={{ backgroundColor: '#0275d8', color: 'white', fontWeight: 'bold' }}>
							<td>Media anual</td>
							<td style={{ textAlign: 'center' }}>{yearlyAverage.toFixed(1)}</td>
						</tr>
					</tbody>
				</table>
			</div>
			</section>

			{/* Gráfica de progresión acumulada */}
			<section id='graficos' className='section'>
			<h2>Gráficos</h2>
			
			{/* Aviso para dispositivos móviles */}
			<div className='mobile-warning'>
				<div className='mobile-warning-icon'>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
						<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
						<line x1="8" y1="21" x2="16" y2="21"/>
						<line x1="12" y1="17" x2="12" y2="21"/>
					</svg>
				</div>
				<p>Para ver los gráficos y el calendario de lluvias, gira tu dispositivo a horizontal o usa una pantalla más grande.</p>
			</div>

			<div style={{ margin: '20px auto', maxWidth: '800px', position: 'relative' }} className='hide-mobile'>
				<Line data={progressionChartData} options={progressionOptions} />
				<button
					onClick={() => setShowFullYear(!showFullYear)}
					style={{
						position: 'absolute',
						top: '8px',
						right: '5px',
						padding: '6px 12px',
						backgroundColor: showFullYear ? 'rgba(255, 99, 132, 0.9)' : 'rgba(0, 0, 0, 0.5)',
						color: 'white',
						border: 'none',
						borderRadius: '4px',
						cursor: 'pointer',
						fontSize: '12px',
						fontWeight: '500',
						transition: 'background-color 0.2s',
					}}
				>
					{showFullYear ? 'Previsión anual' : 'Previsión anual'}
				</button>
			</div>

			{/* Gráfica con los datos anuales */}
			<div style={{ margin: '30px auto', maxWidth: '800px' }} className='hide-mobile'>
				<Bar data={chartData} options={options} />
			</div>

			{/* Gráfica con la media mensual */}
			<div style={{ margin: '30px auto', maxWidth: '800px' }} className='hide-mobile'>
				<Bar data={monthlyAverageChartData} options={monthlyAverageOptions} />
			</div>

			{/* Calendario de lluvias */}
			<div className='heatmap-container hide-mobile' onClick={handleHeatmapContainerClick}>
				<h2>Calendario de lluvias</h2>
				<p style={{ textAlign: 'center', color: '#666', marginBottom: '10px', fontSize: '0.9rem' }}>
					Haz click en un día para ver los detalles
				</p>
				<div className='heatmap-mode-toggle'>
					<button
						className={heatmapMode === 'total' ? 'active' : ''}
						onClick={() => { setHeatmapMode('total'); setActiveTooltip(null); }}
					>
						Por litros totales
					</button>
					<button
						className={heatmapMode === 'count' ? 'active' : ''}
						onClick={() => { setHeatmapMode('count'); setActiveTooltip(null); }}
					>
						Por días con lluvia
					</button>
				</div>
				<div className='heatmap-grid'>
					{calendarMonths.map((month) => (
						<div key={month.month} className='heatmap-month'>
							<div className='heatmap-month-name'>{month.name}</div>
							<div className='heatmap-days'>
								{Array.from({ length: month.days }, (_, i) => {
									const day = String(i + 1).padStart(2, '0')
									const key = `${month.month}-${day}`
									const dayData = heatmapData[key] || { total: 0, count: 0, average: 0, entries: [] }
									const isActive = activeTooltip === key
									return (
										<div
											key={key}
											className={`heatmap-day ${isActive ? 'active' : ''}`}
											style={{ backgroundColor: getHeatColor(dayData) }}
											onClick={(e) => { e.stopPropagation(); setActiveTooltip(isActive ? null : key); }}
										>
											{i + 1}
											{isActive && (
												<div className='heatmap-tooltip'>
													<div className='heatmap-tooltip-header'>{i + 1} de {month.name}</div>
													<div className='heatmap-tooltip-stats'>
														<div className='stat'><span>{dayData.total.toFixed(1)}</span><small>litros</small></div>
														<div className='stat'><span>{dayData.count}</span><small>{dayData.count === 1 ? 'día' : 'días'}</small></div>
													</div>
													{dayData.entries.length > 0 && (
														<div className='heatmap-tooltip-list'>
															{dayData.entries.map((entry, idx) => (
																<div key={idx} className='heatmap-tooltip-entry'>
																	<span>{entry.year}</span>
																	<span>{entry.litros} L</span>
																</div>
															))}
														</div>
													)}
												</div>
											)}
										</div>
									)
								})}
							</div>
						</div>
					))}
				</div>
				<div className='heatmap-legend'>
					<span>{heatmapMode === 'total' ? 'Menos litros' : 'Menos días'}</span>
					<div className='heatmap-legend-colors'>
						<div style={{ backgroundColor: '#e3f2fd' }}></div>
						<div style={{ backgroundColor: '#90caf9' }}></div>
						<div style={{ backgroundColor: '#42a5f5' }}></div>
						<div style={{ backgroundColor: '#1976d2' }}></div>
						<div style={{ backgroundColor: '#0d47a1' }}></div>
					</div>
					<span>{heatmapMode === 'total' ? 'Más litros' : 'Más días'}</span>
				</div>
			</div>
			</section>

			<section id='datos' className='section'>
			<h2>Datos completos por año</h2>
			<div className='year'>
				{years.map((year) => (
					<div key={year}>
						<h3>
							{year}-{parseInt(year) + 1}
						</h3>
						<table className='table'>
							<thead>
								<tr>
									<th>Fecha</th>
									<th>Litros</th>
								</tr>
							</thead>
							<tbody>
								{organizedData[year].data
									.reverse()
									.map((item, index) => (
										<tr key={index}>
											<td>{item.fecha}</td>
											<td>{item.litros}</td>
										</tr>
									))}
								{year === oldestHydrologicalYear && (
									<>
										<tr>
											<td>Septiembre</td>
											<td>33</td>
										</tr>
										<tr>
											<td>Octubre</td>
											<td>54</td>
										</tr>
										<tr>
											<td>4/11/2014</td>
											<td>33</td>
										</tr>
										<tr>
											<td>8/11/2014</td>
											<td>20</td>
										</tr>
										<tr>
											<td>Hasta 14/11/14</td>
											<td>59</td>
										</tr>
									</>
								)}
							</tbody>
						</table>
						<h4>Acumulados por mes</h4>
						{year === years[years.length - 1] ? (
							<table className='table'>
								<tbody>
									<tr>
										<td>
											<strong>Total anual</strong>
										</td>
										<td>
											<strong>473</strong>
										</td>
									</tr>
								</tbody>
							</table>
						) : (
							<table className='table'>
								<thead>
									<tr>
										<th>Mes</th>
										<th>Acumulado</th>
									</tr>
								</thead>
								<tbody>
									{adjustedMonthlyTotals(organizedData[year].monthlyTotals).map((total, index) => (
										<tr key={index}>
											<td>{new Date(0, (index + 8) % 12).toLocaleString('es', { month: 'long' })}</td>
											<td>{total || 0}</td>
										</tr>
									))}
									<tr>
										<td>
											<strong>Total anual</strong>
										</td>
										<td>
											<strong>{(organizedData[year].totalAnnual).toFixed(1)}</strong>
										</td>
									</tr>
								</tbody>
							</table>
						)}
					</div>
				))}
			</div>
			</section>

			<footer className='app-footer'>
				<div className='footer-content'>
					<div className='footer-visits'>Visitas desde 18/08/24: {counter}</div>
					<div className='footer-credits'>
						<span>Web y automatización - <a href="https://domindez.com">Daniel Domínguez</a></span>
					</div>
				</div>
			</footer>
			</div>
		</div>
	)
}

export default App
