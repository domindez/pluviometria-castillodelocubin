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

		data.forEach((item) => {
			const itemDate = new Date(item.fecha)
			const itemYear = getHydrologicalYear(item.fecha)

			// Limitar al rango del 1 de septiembre del año hidrológico anterior hasta la fecha equivalente del año actual
			const startOfPreviousYear = new Date(currentHydrologicalYear - 1, 8, 1)
			const equivalentDateLastYear = new Date(currentHydrologicalYear, currentMonth, currentDate)

			if (itemDate >= startOfPreviousYear && itemDate <= equivalentDateLastYear) {
				const previousYear = itemYear + 1
				if (organizedData[previousYear]) {
					organizedData[previousYear].previousYearAccumulated += item.litros
				}
			}
		})

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
