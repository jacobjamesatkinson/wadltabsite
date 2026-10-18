export type PublicDrawRow = {
  id: string;
  venue: string;
  venueId: string | null;
  venueAddress: string;
  room: string;
  date: string;
  dateSort: string;
  timeslot: string;
  timeslotSort: number;
  timeslotId: string | null;
  affirmative: string;
  negative: string;
  /** Institution names for either team in the debate (for filtering). */
  institutions: string[];
  adjudicators: string;
  comments: string;
  divisionId: string;
  divisionName: string;
  roundId: string;
  roundName: string;
  roundNumber: number;
};

export type FilterOption = { id: string; name: string };

export type RoundMenuItem = {
  id: string;
  name: string;
  number: number;
};
