import { useEffect, useState } from 'react'
import './sass/App.scss'
import InsertDataModal from './InsertDataModal'

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
				console.log('Iniciando fetch...') // LOG
				const response = await fetch('https://backend-pluviometria-production.up.railway.app/api/get-data', {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				})

				console.log('Respuesta HTTP:', response.status) // LOG

				if (!response.ok) {
					throw new Error('La petición falló')
				}

				const completeData = await response.json()
				console.log('Datos recibidos desde el backend:', completeData) // LOG

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

	console.log('HOY:', today.toISOString()) // LOG
	console.log('currentHydrologicalYear:', currentHydrologicalYear) // LOG

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

			acc[hydroYear].data.push({
				...item,
				fecha: formatDate(item.fecha),
				fechaOriginal: item.fecha
			})
			acc[hydroYear].monthlyTotals[month] += item.litros

			return acc
		}, {})

		// LOG: Comprobamos los datos en organizedData tras el primer reduce
		console.log('organizedData tras el primer reduce:', JSON.parse(JSON.stringify(organizedData)))

		data.forEach((item) => {
			const itemDate = new Date(item.fecha)
			const itemYear = getHydrologicalYear(item.fecha)

			const startOfPreviousYear = new Date(currentHydrologicalYear - 1, 8, 1)
			const equivalentDateLastYear = new Date(currentHydrologicalYear, currentMonth, currentDate)

			// LOG: Para cada item, veamos su fecha y lo que consideramos como rango
			console.log(
				'Item date:', itemDate.toISOString(),
				'| itemYear:', itemYear,
				'| startOfPreviousYear:', startOfPreviousYear.toISOString(),
				'| equivalentDateLastYear:', equivalentDateLastYear.toISOString()
			)

			if (itemDate >= startOfPreviousYear && itemDate <= equivalentDateLastYear) {
				const previousYear = itemYear + 1
				// LOG: Vemos si existe organizedData[previousYear] y sumamos
				if (organizedData[previousYear]) {
					console.log(`\tSumando a previousYearAccumulated de year=${previousYear}:`, item.litros) // LOG
					organizedData[previousYear].previousYearAccumulated += item.litros
				} else {
					console.log(`\tNo existe organizedData para year=${previousYear}, no sumamos.`) // LOG
				}
			}
		})

		// Asegurar totales
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

		// LOG final: organizedData terminado
		console.log('organizedData final:', JSON.parse(JSON.stringify(organizedData)))
		return organizedData
	}

	const organizedData = formatData(data)
	let mostRecentDate =
		data.length > 0 ? new Date(Math.max(...data.map((e) => new Date(e.fecha).getTime()))) : today
	let daysWithoutRain = Math.floor((today - mostRecentDate) / (1000 * 60 * 60 * 24))

	console.log('Fecha más reciente de lluvia:', mostRecentDate.toISOString()) // LOG

	const years = Object.keys(organizedData).sort((a, b) => b - a)
	const oldestHydrologicalYear = years[years.length - 1]

	const adjustedMonthlyTotals = (monthlyTotals) => {
		const startOfHydrologicalYear = 8
		return [
			...monthlyTotals.slice(startOfHydrologicalYear), 
			...monthlyTotals.slice(0, startOfHydrologicalYear),
		].map((total) => parseFloat(total.toFixed(1))) 
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
								{organizedData[year].data.reverse().map((item, index) => (
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
											<td>
												{new Date(0, (index + 8) % 12).toLocaleString('es', {
													month: 'long'
												})}
											</td>
											<td>{total || 0}</td>
										</tr>
									))}
									<tr>
										<td>
											<strong>Total anual</strong>
										</td>
										<td>
											<strong>{organizedData[year].totalAnnual.toFixed(1)}</strong>
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
