type Themes = {
    [theme: string]: {
        primaryColor: string;
        primaryTextColor: string;
        backgroundImage: string;
        aero: boolean;
    };
};

const themes: Themes = {
    default: {
        primaryColor: '9, 188, 139',
        primaryTextColor: '0, 0, 0',
        backgroundImage: '',
        aero: false,
    },
};

export default themes;
