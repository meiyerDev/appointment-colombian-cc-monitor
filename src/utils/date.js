class DateUtils {
    static differenceInHours(date1, date2) {
        const startDate = new Date(date1);
        const endDate = new Date(date2);
        const diffMs = Math.abs(startDate - endDate);
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours;
    }

    static formatDate(date) {
        const fecha = new Date(dateTimeString);
        const diaSemana = fecha.toLocaleDateString('es-ES', { weekday: 'long' });
        const mes = fecha.toLocaleDateString('es-ES', { month: 'long' });
        const dia = fecha.getDate();
        const año = fecha.getFullYear();
        const diaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
        const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);

        // e.g., "Lunes, Enero 1, 2024."
        return `${diaCapitalizado}, ${mesCapitalizado} ${dia}, ${año}.`;
    }
}

module.exports = DateUtils;