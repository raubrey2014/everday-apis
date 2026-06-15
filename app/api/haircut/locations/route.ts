export async function GET() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateStr = tomorrow.toISOString().slice(0, 10)

  const slots = [
    { hour: 9, minute: 0, displayTime: '9:00 AM' },
    { hour: 11, minute: 30, displayTime: '11:30 AM' },
    { hour: 14, minute: 0, displayTime: '2:00 PM' },
    { hour: 16, minute: 30, displayTime: '4:30 PM' },
  ].map(({ hour, minute, displayTime }) => ({
    time: `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
    displayTime,
  }))

  return Response.json({
    locations: [
      {
        id: 'boston-newbury',
        name: 'Machine Cuts',
        address: '123 Newbury St, Boston, MA 02116',
        availableSlots: slots,
      },
    ],
  })
}
