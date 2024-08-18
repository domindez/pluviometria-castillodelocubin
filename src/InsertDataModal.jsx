/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Modal, Box, TextField, Button } from '@mui/material'

const InsertDataModal = ({ open, handleClose, onSubmitSuccess }) => {
	const [newData, setNewData] = useState({ fecha: '', litros: '', clave: '' })

	const handleChange = (e) => {
		setNewData({ ...newData, [e.target.name]: e.target.value })
	}

	const handleSubmit = async (e) => {
		e.preventDefault()
		try {
			// const response = await fetch('http://localhost:4000/api/insert-data', {
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
			alert('Datos insertados correctamente')
			handleClose()
			onSubmitSuccess(result.data)
		} catch (error) {
			console.error('Error al enviar los datos:', error)
		}
	}

	return (
		<Modal open={open} onClose={handleClose}>
			<Box
				component="form"
				onSubmit={handleSubmit}
				sx={{
					position: 'absolute',
					top: '50%',
					left: '50%',
					transform: 'translate(-50%, -50%)',
					width: 400,
					bgcolor: 'background.paper',
					boxShadow: 24,
					p: 4,
				}}
			>
				<h2>Insertar nuevo dato</h2>
				<TextField
					label="Fecha"
					type="date"
					name="fecha"
					fullWidth
					value={newData.fecha}
					onChange={handleChange}
					InputLabelProps={{ shrink: true }}
					margin="normal"
					required
				/>
				<TextField
					label="Litros"
					type="number"
					name="litros"
					fullWidth
					value={newData.litros}
					onChange={handleChange}
					margin="normal"
					required
				/>
				<TextField
					label="Clave"
					type="password"
					name="clave"
					fullWidth
					value={newData.clave}
					onChange={handleChange}
					margin="normal"
					required
				/>
				<Button type="submit" variant="contained" color="primary" fullWidth>
					Enviar
				</Button>
			</Box>
		</Modal>
	)
}

export default InsertDataModal
