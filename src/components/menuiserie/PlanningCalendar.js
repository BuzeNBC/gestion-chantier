import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { PLANNING_HOURS, HIDDEN_DAYS, initials, eventToPatch } from '../../services/planningService';

// Enveloppe FullCalendar du planning menuiserie. Chargé à la demande
// (React.lazy) : ~90 ko gz qui ne pèsent que sur ceux qui ouvrent le planning.
//
// Props :
//   events           événements FullCalendar (cf. orderToEvent)
//   canEdit          drag & drop / resize / drop externe autorisés
//   isMobile         vue Jour + liste, toolbar compacte
//   menuisiersById   { id: { Name } } pour la pastille d'initiales
//   onEventClick(order)
//   onEventChange(order, patch, revert)   après drag/drop/resize
//   onExternalDrop(orderId, patch)        bon glissé depuis « À planifier »
//   onDateClick(dateStr)                  clic sur un créneau vide
const renderEvent = (arg, menuisiersById) => {
  const order = arg.event.extendedProps.order || {};
  const m = order.assigned_to ? menuisiersById?.[order.assigned_to] : null;
  const isList = arg.view.type.startsWith('list');
  return (
    <div className={`fc-ev ${isList ? 'fc-ev-list' : ''}`}>
      <div className="fc-ev-line">
        {arg.timeText && !isList && <span className="fc-ev-time">{arg.timeText}</span>}
        {order.is_urgent && <span className="fc-ev-urgent" title="Urgent">!</span>}
        <span className="fc-ev-title">{order.client_name || arg.event.title}</span>
        {m && <span className="fc-ev-who" title={m.Name}>{initials(m.Name)}</span>}
      </div>
      {!isList && order.address && <div className="fc-ev-sub">{order.address}</div>}
    </div>
  );
};

export default function PlanningCalendar({
  events,
  canEdit = false,
  isMobile = false,
  menuisiersById = {},
  onEventClick,
  onEventChange,
  onExternalDrop,
  onDateClick,
  calendarRef,
}) {
  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
      locale={frLocale}
      initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
      headerToolbar={isMobile
        ? { left: 'prev,next', center: 'title', right: 'timeGridDay,listWeek' }
        : { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay,dayGridMonth,listWeek' }}
      buttonText={{ today: "Aujourd'hui", week: 'Semaine', day: 'Jour', month: 'Mois', list: 'Liste' }}
      firstDay={1}
      hiddenDays={HIDDEN_DAYS}
      slotMinTime={PLANNING_HOURS.min}
      slotMaxTime={PLANNING_HOURS.max}
      slotDuration="00:30:00"
      snapDuration="00:15:00"
      allDaySlot
      allDayText="Journée"
      nowIndicator
      height="auto"
      expandRows
      dayMaxEvents={4}
      editable={canEdit}
      droppable={canEdit}
      eventStartEditable={canEdit}
      eventDurationEditable={canEdit}
      longPressDelay={400}
      eventLongPressDelay={400}
      selectLongPressDelay={400}
      eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      events={events}
      eventContent={(arg) => renderEvent(arg, menuisiersById)}
      eventClick={(info) => {
        info.jsEvent.preventDefault();
        onEventClick?.(info.event.extendedProps.order);
      }}
      eventDrop={(info) => onEventChange?.(info.event.extendedProps.order, eventToPatch(info.event), info.revert)}
      eventResize={(info) => onEventChange?.(info.event.extendedProps.order, eventToPatch(info.event), info.revert)}
      eventReceive={(info) => {
        // Bon glissé depuis le panneau « À planifier » : on calcule le patch,
        // on retire l'événement temporaire (l'état React le recréera) et on
        // laisse le parent écrire en base.
        const orderId = info.event.id;
        const patch = eventToPatch(info.event);
        info.event.remove();
        onExternalDrop?.(orderId, patch);
      }}
      dateClick={(info) => onDateClick?.(info)}
    />
  );
}
