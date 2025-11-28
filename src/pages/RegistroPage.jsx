import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../sass/App.scss'
import '../sass/RegistroPage.scss'

// eslint-disable-next-line react/prop-types
const RegistroPage = ({ onSubmitSuccess }) => {
	const [newData, setNewData] = useState({ fecha: '', litros: '', clave: '' })
	const [loading, setLoading] = useState(false)
	const [message, setMessage] = useState(null)

	const handleChange = (e) => {
		setNewData({ ...newData, [e.target.name]: e.target.value })
	}

	const handleSubmit = async (e) => {
		e.preventDefault()
		setLoading(true)
		setMessage(null)
		
		try {
			const response = await fetch('https://backend-pluviometria-production.up.railway.app/api/insert-data', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(newData),
			})

			if (!response.ok) {
				throw new Error('Error al insertar los datos')
			}

			const result = await response.json()
			setMessage({ type: 'success', text: 'Datos insertados correctamente' })
			setNewData({ fecha: '', litros: '', clave: '' })
			if (onSubmitSuccess) {
				onSubmitSuccess(result.data)
			}
		} catch (error) {
			console.error('Error al enviar los datos:', error)
			setMessage({ type: 'error', text: 'Error al insertar los datos. Verifica la clave.' })
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="registro-page">
			<header className='app-header'>
				<div className='header-text'>
					<h1>Registro de lluvias de Castillo de Locubín</h1>
					<p>Datos recogidos por Rafael Muñoz y Jose Manuel Domínguez</p>
				</div>
			</header>
			
			<div className="registro-content">
				<div className="registro-card">
					<h2>Insertar nuevo registro</h2>
					
					<form onSubmit={handleSubmit} className="registro-form">
						<div className="form-group">
							<label htmlFor="fecha">Fecha</label>
							<input
								type="date"
								id="fecha"
								name="fecha"
								value={newData.fecha}
								onChange={handleChange}
								required
							/>
						</div>
						
						<div className="form-group">
							<label htmlFor="litros">Litros</label>
							<input
								type="number"
								id="litros"
								name="litros"
								value={newData.litros}
								onChange={handleChange}
								placeholder="Ej: 12.5"
								step="0.1"
								required
							/>
						</div>
						
						<div className="form-group">
							<label htmlFor="clave">Clave de acceso</label>
							<input
								type="password"
								id="clave"
								name="clave"
								value={newData.clave}
								onChange={handleChange}
								required
							/>
						</div>

						{message && (
							<div className={`message ${message.type}`}>
								{message.text}
							</div>
						)}
						
						<button type="submit" className="submit-btn" disabled={loading}>
							{loading ? 'Enviando...' : 'Registrar datos'}
						</button>
					</form>
					
					<Link to="/" className="back-link">
						← Volver al inicio
					</Link>
				</div>
			</div>

			<footer className='app-footer'>
				<div className='footer-content'>
					<div className='footer-credits'>
						<span>Web y automatización - <a href="https://domindez.com">Daniel Domínguez</a></span>
					</div>
				</div>
			</footer>
		</div>
	)
}

export default RegistroPage
