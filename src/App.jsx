import { useEffect, useState } from 'react'
import './sass/App.scss'
import InsertDataModal from './InsertDataModal'
import { Bar } from 'react-chartjs-2'
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	BarElement,
	Title,
	Tooltip,
	Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

function App() {
	const [data, setData] = useState([])
	const [counter, setCounter] = useState(0)
	const [loading, setLoading] = useState(false)
	const [openModal, setOpenModal] = useState(false)

	const handleOpenModal = () => setOpenModal(true)
	const handleCloseModal = () => setOpenModal(false)

	const handleDataInsertSuccess = (newEntry) => {
		setData([...data, newEntry])
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

	// Calcular media mensual desde 2015-2016
	const calculateMonthlyAverages = () => {
		const startYearForAverage = 2015
		const monthlyAccumulated = Array(12).fill(0).map(() => ({ sum: 0, count: 0 }))

		Object.keys(organizedData).forEach((year) => {
			const yearNum = parseInt(year)
			if (yearNum >= startYearForAverage && yearNum < currentHydrologicalYear) {
				organizedData[year].monthlyTotals.forEach((total, monthIndex) => {
					if (total > 0) {
						monthlyAccumulated[monthIndex].sum += total
						monthlyAccumulated[monthIndex].count += 1
					}
				})
			}
		})

		// Calcular media y ajustar al orden del año hidrológico
		const averages = monthlyAccumulated.map((month) => 
			month.count > 0 ? parseFloat((month.sum / month.count).toFixed(1)) : 0
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
				text: `Media mensual de litros (desde 2015-2016)`,
			},
		},
		scales: {
			y: {
				beginAtZero: true,
			},
		},
	}

	if (loading) {
		return (
			<div>
				<h1>Registro de lluvias en Castillo de Locubín</h1>
				<div className='loader'></div>
			</div>
		)
	}
	return (
		<div>
			<h1>Registro de lluvias en Castillo de Locubín</h1>
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

			{/* Nueva tabla: Total años anteriores */}
			<div className='total-year'>
				<h2>Total años anteriores</h2>
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
					</tbody>
				</table>
			</div>

			{/* Gráfica con los datos anuales */}
			<div style={{ margin: '40px auto', maxWidth: '800px' }} className='hide-mobile'>
				<Bar data={chartData} options={options} />
			</div>

			{/* Gráfica con la media mensual */}
			<div style={{ margin: '40px auto', maxWidth: '800px' }} className='hide-mobile'>
				<Bar data={monthlyAverageChartData} options={monthlyAverageOptions} />
			</div>

			<br />
			<h2>Datos completos por año</h2>
			<br />
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

			<div className='counter'>Visitas desde 18/08/24: {counter}</div>

			<p className='signature'>
				Datos recogidos por <br /> Rafael Muñoz y <br />
				Jose Manuel <span onClick={handleOpenModal}>Domínguez</span>.
			</p>
			<p className='signature'>
				Web y automatización - <a href="https://domindez.com">Daniel Domínguez</a>
			</p>
			<InsertDataModal open={openModal} handleClose={handleCloseModal} onSubmitSuccess={handleDataInsertSuccess} />
		</div>
	)
}

export default App
