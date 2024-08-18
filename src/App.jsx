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
				// const response = await fetch('http://localhost:4000/api/get-data', {
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
	const currentHydrologicalYear = today.getFullYear() - (currentMonth < 8 ? 1 : 0)

	const formatData = (data) => {
		const today = new Date()
		const currentMonth = today.getMonth()
		const currentDate = today.getDate()
		const currentHydrologicalYear = today.getFullYear() - (currentMonth < 8 ? 1 : 0)
		const lastHydrologicalYearStart = new Date(currentHydrologicalYear - 1, 8, 1)
		const currentHydrologicalYearStart = new Date(currentHydrologicalYear, 8, 1)

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

		// Definir el inicio del año hidrológico de hace dos años
		const twoYearsAgoHydrologicalYearStart = new Date(currentHydrologicalYearStart.getFullYear() - 2, 8, 1)
		// Definir el final del año natural de hace dos años
		const endOfTwoYearsAgo = new Date(currentHydrologicalYearStart.getFullYear() - 1, 11, 31) // 31 de Diciembre

		data.forEach((item) => {
			const itemDate = new Date(item.fecha)
			// Comprobar si la fecha del registro está dentro del año hidrológico anterior
			if (itemDate >= lastHydrologicalYearStart && itemDate < currentHydrologicalYearStart) {
				if (
					itemDate.getMonth() < currentMonth ||
					(itemDate.getMonth() === currentMonth && itemDate.getDate() <= currentDate)
				) {
					const previousYear = getHydrologicalYear(item.fecha) + 1
					if (organizedData[previousYear]) {
						organizedData[previousYear].previousYearAccumulated += item.litros
					}
				}
			}
			// Adicionalmente, comprobar si la fecha está entre el 1 de septiembre y el 31 de diciembre de hace dos años
			if (itemDate >= twoYearsAgoHydrologicalYearStart && itemDate <= endOfTwoYearsAgo) {
				const previousYear = getHydrologicalYear(item.fecha) + 1
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

		Object.keys(organizedData).forEach((year) => {
			// Ordenar los datos de cada año por fecha antes de calcular los totales
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
							<td>Total litros este año</td>
							<td style={{ textAlign: 'center' }}>
								{(organizedData[currentHydrologicalYear]?.totalAnnual || 0).toFixed(1)}
							</td>
						</tr>
						<tr>
							<td>Litros año anterior por estas fechas</td>
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
								{/* Código existente para mostrar los acumulados mensuales y el total anual */}
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
